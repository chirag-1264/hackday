import logging
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from twilio.twiml.voice_response import VoiceResponse, Gather

from app.database import get_database
from app.services.gemma_service import gemma_service
from app.services.appointment_service import appointment_service
from app.models.appointment import AppointmentCreate, BookingSource
from app.config import settings

logger = logging.getLogger(__name__)

class IVRService:
    async def get_or_create_session(self, call_sid: str, caller_phone: str = "") -> Dict[str, Any]:
        db = get_database()
        session = await db.ivr_sessions.find_one({"call_sid": call_sid})
        if not session:
            now = datetime.utcnow()
            session = {
                "call_sid": call_sid,
                "step": "welcome",
                "language": "en",
                "caller_phone": caller_phone or "+919876543210",
                "intent": None,
                "clinic_id": None,
                "clinic_name": None,
                "specialty": None,
                "doctor_id": None,
                "doctor_name": None,
                "preferred_date": None,
                "preferred_time": None,
                "patient_name": "Phone Caller",
                "available_slots": [],
                "selected_slot": None,
                "created_appointment_ref": None,
                "emergency_flag": False,
                "turn_count": 0,
                "history": [],
                "created_at": now,
                "updated_at": now
            }
            await db.ivr_sessions.insert_one(session)
        return session

    async def update_session(self, call_sid: str, updates: Dict[str, Any]):
        db = get_database()
        updates["updated_at"] = datetime.utcnow()
        await db.ivr_sessions.update_one({"call_sid": call_sid}, {"$set": updates})

    def generate_welcome_twiml(self, action_url: str) -> str:
        response = VoiceResponse()
        gather = Gather(
            input="speech dtmf",
            num_digits=1,
            timeout=5,
            action=action_url,
            language="en-IN"
        )
        gather.say(
            "Namaste and welcome to SwasthyaCall, your automated AI healthcare assistant. "
            "For English, press 1 or say English. Hindi ke liye, press 2 ya Hindi kahein.",
            voice="Polly.Aditi",
            language="hi-IN"
        )
        response.append(gather)
        response.say("We did not receive any input. Goodbye.")
        response.hangup()
        return str(response)

    async def process_turn(
        self, call_sid: str, speech_result: str, digits: str, base_url: str
    ) -> Dict[str, Any]:
        session = await self.get_or_create_session(call_sid)
        step = session.get("step", "welcome")
        lang = session.get("language", "en")
        caller_input = (speech_result or digits or "").strip()

        logger.info(f"IVR Turn - Session {call_sid}, Step: {step}, Input: '{caller_input}'")

        voice_name = "Polly.Aditi" if lang == "hi" else "Polly.Raveena"
        speech_lang = "hi-IN" if lang == "hi" else "en-IN"

        # Step 1: Welcome / Language Selection
        if step == "welcome":
            if digits == "2" or "hindi" in caller_input.lower():
                lang = "hi"
            else:
                lang = "en"
            
            await self.update_session(call_sid, {"language": lang, "step": "gather_intent"})
            
            prompt_text = (
                "Namaste. Main SwasthyaCall ka AI assistant hoon. "
                "Yeh medical emergency ke liye nahi hai. "
                "Aap kis takleef ya appointment ke silsile mein call kar rahe hain? "
                "Kripya doctor ka prakar ya bimari aur apna pasandida din batayein."
                if lang == "hi"
                else
                "Welcome to SwasthyaCall. I am your automated healthcare assistant. "
                "This service is not for medical emergencies. "
                "Please tell me what appointment you need, such as doctor specialty and your preferred day."
            )
            
            resp = VoiceResponse()
            gather = Gather(input="speech", timeout=6, action=f"{base_url}/api/ivr/process", language=speech_lang)
            gather.say(prompt_text, voice=voice_name, language=speech_lang)
            resp.append(gather)
            return {
                "twiml": str(resp),
                "bot_response": prompt_text,
                "step": "gather_intent",
                "language": lang,
                "active_model": gemma_service.model_name,
                "provider": gemma_service.provider,
                "model_version": f"{gemma_service.provider.upper()}: {gemma_service.model_name}"
            }

        # Step 2: Gather Intent & AI Interpretation
        if step in ["gather_intent", "clarify"]:
            try:
                gemma_res = await gemma_service.parse_intent_and_entities(
                    caller_input, caller_lang=lang, current_state=session
                )
            except Exception as e:
                logger.error(f"Intent extraction error: {e}")
                await self.update_session(call_sid, {"step": "error", "last_error": str(e)})
                err_text = (
                    f"AI Service Error ({gemma_service.provider}): {str(e)}"
                )
                resp = VoiceResponse()
                resp.say(err_text, voice=voice_name, language=speech_lang)
                resp.hangup()
                return {
                    "twiml": str(resp),
                    "bot_response": err_text,
                    "step": "error",
                    "error": str(e),
                    "is_emergency": False,
                    "active_model": gemma_service.model_name,
                    "provider": gemma_service.provider,
                    "model_version": f"{gemma_service.provider.upper()}: {gemma_service.model_name}"
                }

            # Record turn in history
            history = session.get("history", [])
            history.append({"user": caller_input, "bot": gemma_res.response_text})

            # Check emergency
            if gemma_res.is_emergency:
                await self.update_session(call_sid, {
                    "step": "emergency",
                    "emergency_flag": True,
                    "history": history
                })
                resp = VoiceResponse()
                resp.say(gemma_res.emergency_advice, voice=voice_name, language=speech_lang)
                resp.say(
                    "Disconnecting call now so you can immediately reach emergency services. Goodbye."
                    if lang == "en" else "Kripya turant 112 par call karein. Namaste.",
                    voice=voice_name, language=speech_lang
                )
                resp.hangup()
                return {
                    "twiml": str(resp),
                    "bot_response": gemma_res.emergency_advice,
                    "step": "emergency",
                    "is_emergency": True,
                    "gemma_output": gemma_res.model_dump()
                }

            # Update session with extracted fields
            updates: Dict[str, Any] = {
                "history": history,
                "intent": gemma_res.intent
            }
            if gemma_res.specialty:
                updates["specialty"] = gemma_res.specialty
            if gemma_res.preferred_date:
                updates["preferred_date"] = gemma_res.preferred_date
            if gemma_res.preferred_time:
                updates["preferred_time"] = gemma_res.preferred_time
            if gemma_res.clinic_name:
                updates["clinic_name"] = gemma_res.clinic_name

            merged_state = {**session, **updates}

            # If still missing specialty or date, ask follow-up
            if not merged_state.get("specialty") or not merged_state.get("preferred_date"):
                await self.update_session(call_sid, {**updates, "step": "clarify"})
                resp = VoiceResponse()
                gather = Gather(input="speech", timeout=6, action=f"{base_url}/api/ivr/process", language=speech_lang)
                gather.say(gemma_res.response_text, voice=voice_name, language=speech_lang)
                resp.append(gather)
                return {
                    "twiml": str(resp),
                    "bot_response": gemma_res.response_text,
                    "step": "clarify",
                    "gemma_output": gemma_res.model_dump(),
                    "active_model": gemma_service.model_name,
                    "provider": gemma_service.provider,
                    "model_version": gemma_res.model_version
                }

            # We have specialty and date -> Check real availability from MongoDB
            db = get_database()
            clinic = None
            if merged_state.get("clinic_name"):
                clinic = await db.clinics.find_one({"name": {"$regex": merged_state["clinic_name"], "$options": "i"}})
            if not clinic:
                clinic = await db.clinics.find_one({"active": True})
            
            clinic_id = str(clinic["_id"]) if clinic else "default"
            target_date = merged_state.get("preferred_date") or (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")

            slots = await appointment_service.get_available_slots(
                clinic_id=clinic_id,
                appointment_date=target_date,
                specialty=merged_state.get("specialty", "general_medicine")
            )
            valid_available = [s for s in slots if s.get("available")]

            if not valid_available:
                no_slot_msg = (
                    f"Kshama karein, {target_date} ko koi slot uplabdh nahi hai. Kripya kisi doosre din ka batayein."
                    if lang == "hi" else
                    f"We apologize, but no slots are available for {merged_state.get('specialty')} on {target_date}. Please choose another date."
                )
                await self.update_session(call_sid, {**updates, "preferred_date": None, "step": "clarify"})
                resp = VoiceResponse()
                gather = Gather(input="speech", timeout=6, action=f"{base_url}/api/ivr/process", language=speech_lang)
                gather.say(no_slot_msg, voice=voice_name, language=speech_lang)
                resp.append(gather)
                return {"twiml": str(resp), "bot_response": no_slot_msg, "step": "clarify"}

            # Offer up to 2 slots
            offered = valid_available[:2]
            slot_options_text = ""
            for i, s in enumerate(offered, start=1):
                slot_options_text += f"Option {i}: {s['start_time']}. "

            prompt_offer = (
                f"{clinic.get('name', 'Hamari clinic')} mein {target_date} ke liye slots hain: {slot_options_text}. "
                "Pehle slot ke liye 1 dabayein, doosre ke liye 2 dabayein."
                if lang == "hi" else
                f"Available slots at {clinic.get('name', 'our clinic')} for {target_date} are: {slot_options_text}. "
                "Press 1 for option 1, or press 2 for option 2."
            )

            await self.update_session(call_sid, {
                **updates,
                "step": "offer_slots",
                "clinic_id": clinic_id,
                "clinic_name": clinic.get("name"),
                "available_slots": offered
            })

            resp = VoiceResponse()
            gather = Gather(input="speech dtmf", num_digits=1, timeout=6, action=f"{base_url}/api/ivr/process", language=speech_lang)
            gather.say(prompt_offer, voice=voice_name, language=speech_lang)
            resp.append(gather)
            return {
                "twiml": str(resp),
                "bot_response": prompt_offer,
                "step": "offer_slots",
                "slots_offered": offered,
                "gemma_output": gemma_res.model_dump(),
                "active_model": gemma_service.model_name,
                "provider": gemma_service.provider,
                "model_version": gemma_res.model_version
            }

        # Step 3: Slot Choice & Confirmation
        if step == "offer_slots":
            offered_slots = session.get("available_slots", [])
            selected_slot = None
            if digits == "1" or "one" in caller_input.lower() or "pehla" in caller_input.lower():
                selected_slot = offered_slots[0] if len(offered_slots) > 0 else None
            elif digits == "2" or "two" in caller_input.lower() or "doosra" in caller_input.lower():
                selected_slot = offered_slots[1] if len(offered_slots) > 1 else None
            elif len(offered_slots) > 0:
                selected_slot = offered_slots[0]

            if not selected_slot:
                retry_msg = "Please press 1 or 2 to select your appointment time slot." if lang == "en" else "Kripya slot chunne ke liye 1 ya 2 dabayein."
                resp = VoiceResponse()
                gather = Gather(input="speech dtmf", num_digits=1, timeout=5, action=f"{base_url}/api/ivr/process", language=speech_lang)
                gather.say(retry_msg, voice=voice_name, language=speech_lang)
                resp.append(gather)
                return {"twiml": str(resp), "bot_response": retry_msg, "step": "offer_slots"}

            # ATOMIC BOOKING in database!
            appt_create = AppointmentCreate(
                patient_name=f"IVR Caller ({session.get('caller_phone', '')[-4:]})",
                patient_phone=session.get("caller_phone", "+919876543210"),
                clinic_id=selected_slot["clinic_id"],
                doctor_id=selected_slot.get("doctor_id"),
                specialty=selected_slot.get("specialty", session.get("specialty", "general_medicine")),
                appointment_date=selected_slot["appointment_date"],
                start_time=selected_slot["start_time"],
                end_time=selected_slot["end_time"],
                booking_source=BookingSource.IVR,
                notes="Booked via Twilio Voice AI IVR"
            )

            created_appt = await appointment_service.create_appointment(appt_create)
            ref_code = created_appt["reference"]

            await self.update_session(call_sid, {
                "step": "complete",
                "selected_slot": selected_slot,
                "created_appointment_ref": ref_code
            })

            success_msg = (
                f"Badhai ho! Aapka appointment safaltapoorvak book ho gaya hai. "
                f"Aapka reference number hai {', '.join(list(ref_code))}. "
                f"Date hai {selected_slot['appointment_date']}, samay {selected_slot['start_time']}. "
                "SwasthyaCall use karne ke liye dhanyavaad. Alvida!"
                if lang == "hi" else
                f"Congratulations! Your appointment is successfully booked. "
                f"Your reference number is {', '.join(list(ref_code))}. "
                f"Date is {selected_slot['appointment_date']} at {selected_slot['start_time']}. "
                "Thank you for using SwasthyaCall. Take care and goodbye!"
            )

            resp = VoiceResponse()
            resp.say(success_msg, voice=voice_name, language=speech_lang)
            resp.hangup()

            return {
                "twiml": str(resp),
                "bot_response": success_msg,
                "step": "complete",
                "appointment_created": created_appt
            }

        # Fallback completion
        resp = VoiceResponse()
        resp.say("Thank you for calling SwasthyaCall. Have a healthy day.", voice=voice_name, language=speech_lang)
        resp.hangup()
        return {"twiml": str(resp), "bot_response": "Thank you for calling.", "step": "complete"}

ivr_service = IVRService()
