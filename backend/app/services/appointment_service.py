import random
import string
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from pymongo.errors import DuplicateKeyError
from fastapi import HTTPException, status
from bson import ObjectId

from app.database import get_database
from app.models.appointment import AppointmentCreate, AppointmentStatus, BookingSource
from app.services.sse_manager import sse_manager
from app.services.notification_service import notification_service

logger = logging.getLogger(__name__)

def generate_appointment_reference() -> str:
    year = datetime.utcnow().year
    random_suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=5))
    return f"SC-{year}-{random_suffix}"

class AppointmentService:
    @staticmethod
    def _to_object_id_or_str(val: str):
        if ObjectId.is_valid(val):
            return ObjectId(val)
        return val

    async def get_available_slots(
        self,
        clinic_id: str,
        appointment_date: str,
        specialty: Optional[str] = None,
        doctor_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        db = get_database()

        # Query doctors matching clinic and specialty
        doc_query: Dict[str, Any] = {"active": True}
        if clinic_id:
            doc_query["$or"] = [
                {"clinic_id": clinic_id},
                {"clinic_id": self._to_object_id_or_str(clinic_id)} if ObjectId.is_valid(clinic_id) else {"clinic_id": clinic_id}
            ]
        if doctor_id:
            doc_query["$or"] = [
                {"_id": doctor_id},
                {"_id": ObjectId(doctor_id)} if ObjectId.is_valid(doctor_id) else {"_id": doctor_id}
            ]
        elif specialty:
            doc_query["specialty"] = {"$regex": f"^{specialty}$", "$options": "i"}

        cursor = db.doctors.find(doc_query)
        doctors = await cursor.to_list(length=100)

        if not doctors:
            # If no specific doctors found, check if clinic has default operating hours
            return []

        # Find day of week for appointment_date
        try:
            req_date = datetime.strptime(appointment_date, "%Y-%m-%d")
            day_name = req_date.strftime("%A")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Expected YYYY-MM-DD")

        available_slots = []

        for doc in doctors:
            d_id = str(doc["_id"])
            working_hours = doc.get("working_hours", {})
            working_days = working_hours.get("days", ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"])
            
            if day_name not in working_days:
                continue

            open_time_str = working_hours.get("start_time", "09:00")
            close_time_str = working_hours.get("end_time", "17:00")
            slot_duration = doc.get("appointment_duration_minutes", 30)

            # Query existing active appointments for this doctor and date
            existing_appts_cursor = db.appointments.find({
                "doctor_id": d_id,
                "appointment_date": appointment_date,
                "status": {"$in": [AppointmentStatus.CONFIRMED.value, AppointmentStatus.PENDING.value]}
            })
            booked_appts = await existing_appts_cursor.to_list(length=200)
            booked_times = {a["start_time"] for a in booked_appts}

            # Generate slots
            start_dt = datetime.strptime(open_time_str, "%H:%M")
            end_dt = datetime.strptime(close_time_str, "%H:%M")
            cur = start_dt

            while cur + timedelta(minutes=slot_duration) <= end_dt:
                slot_start = cur.strftime("%H:%M")
                slot_end = (cur + timedelta(minutes=slot_duration)).strftime("%H:%M")
                
                is_available = slot_start not in booked_times
                available_slots.append({
                    "doctor_id": d_id,
                    "doctor_name": doc.get("name"),
                    "specialty": doc.get("specialty"),
                    "clinic_id": str(doc.get("clinic_id")),
                    "appointment_date": appointment_date,
                    "start_time": slot_start,
                    "end_time": slot_end,
                    "available": is_available
                })
                cur += timedelta(minutes=slot_duration)

        return available_slots

    async def create_appointment(self, appt_in: AppointmentCreate) -> Dict[str, Any]:
        db = get_database()

        # 1. Verify clinic exists
        clinic_query = {"$or": [{"_id": appt_in.clinic_id}]}
        if ObjectId.is_valid(appt_in.clinic_id):
            clinic_query["$or"].append({"_id": ObjectId(appt_in.clinic_id)})
        clinic = await db.clinics.find_one(clinic_query)
        if not clinic:
            raise HTTPException(status_code=404, detail="Selected clinic not found")

        # 2. If doctor not supplied, assign available doctor for specialty
        doc_id = appt_in.doctor_id
        doctor_name = "Assigned Specialist"
        if doc_id:
            doc_query = {"$or": [{"_id": doc_id}]}
            if ObjectId.is_valid(doc_id):
                doc_query["$or"].append({"_id": ObjectId(doc_id)})
            doctor = await db.doctors.find_one(doc_query)
            if doctor:
                doctor_name = doctor.get("name", doctor_name)
        else:
            # Find an active doctor for this specialty and clinic
            doctor = await db.doctors.find_one({
                "clinic_id": str(clinic["_id"]),
                "specialty": {"$regex": f"^{appt_in.specialty}$", "$options": "i"},
                "active": True
            })
            if doctor:
                doc_id = str(doctor["_id"])
                doctor_name = doctor.get("name", doctor_name)

        # 3. Check for conflict in database
        conflict_query = {
            "appointment_date": appt_in.appointment_date,
            "start_time": appt_in.start_time,
            "status": {"$in": [AppointmentStatus.CONFIRMED.value, AppointmentStatus.PENDING.value]}
        }
        if doc_id:
            conflict_query["doctor_id"] = doc_id
        else:
            conflict_query["clinic_id"] = str(clinic["_id"])

        conflict = await db.appointments.find_one(conflict_query)
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"The selected time slot ({appt_in.start_time} on {appt_in.appointment_date}) is no longer available. Please select another slot."
            )

        reference = generate_appointment_reference()
        now = datetime.utcnow()

        appt_doc = {
            "reference": reference,
            "patient_name": appt_in.patient_name.strip(),
            "patient_phone": appt_in.patient_phone.strip(),
            "clinic_id": str(clinic["_id"]),
            "clinic_name": clinic.get("name", "Swasthya Clinic"),
            "doctor_id": doc_id,
            "doctor_name": doctor_name,
            "specialty": appt_in.specialty,
            "appointment_date": appt_in.appointment_date,
            "start_time": appt_in.start_time,
            "end_time": appt_in.end_time,
            "status": AppointmentStatus.CONFIRMED.value,
            "booking_source": appt_in.booking_source.value,
            "notes": appt_in.notes or "",
            "notification_status": "pending",
            "created_at": now,
            "updated_at": now
        }

        # 4. Atomic insert with race condition check
        try:
            insert_result = await db.appointments.insert_one(appt_doc)
            appt_doc["_id"] = str(insert_result.inserted_id)
        except DuplicateKeyError:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Slot conflict: Another patient simultaneously booked this slot. Please select a different time."
            )

        # 5. Broadcast live SSE event
        clean_event_data = {**appt_doc, "_id": str(appt_doc["_id"]), "created_at": now.isoformat(), "updated_at": now.isoformat()}
        await sse_manager.broadcast("appointment_created", clean_event_data)

        # 6. Dispatch Notification
        notif_res = await notification_service.send_booking_confirmation(
            patient_phone=appt_in.patient_phone,
            patient_name=appt_in.patient_name,
            reference=reference,
            clinic_name=clinic.get("name", "Swasthya Clinic"),
            appointment_date=appt_in.appointment_date,
            start_time=appt_in.start_time
        )
        await db.appointments.update_one(
            {"_id": insert_result.inserted_id},
            {"$set": {"notification_status": notif_res.get("status", "simulated")}}
        )

        return appt_doc

    async def lookup_appointment(self, reference: str, phone_verification: str) -> Dict[str, Any]:
        db = get_database()
        appt = await db.appointments.find_one({"reference": reference.strip().upper()})
        if not appt:
            raise HTTPException(status_code=404, detail="Appointment reference not found")

        # Verify phone number (matches full phone or last 4 digits)
        stored_phone = appt.get("patient_phone", "").replace(" ", "").replace("-", "")
        clean_verify = phone_verification.strip().replace(" ", "").replace("-", "")
        
        if clean_verify != stored_phone and not stored_phone.endswith(clean_verify):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Phone verification failed. The provided phone does not match this appointment."
            )

        appt["_id"] = str(appt["_id"])
        return appt

    async def cancel_appointment(self, reference: str, phone_verification: str) -> Dict[str, Any]:
        appt = await self.lookup_appointment(reference, phone_verification)
        db = get_database()
        now = datetime.utcnow()

        await db.appointments.update_one(
            {"reference": reference.strip().upper()},
            {"$set": {"status": AppointmentStatus.CANCELLED.value, "updated_at": now}}
        )

        appt["status"] = AppointmentStatus.CANCELLED.value
        appt["updated_at"] = now.isoformat()

        if isinstance(appt.get("created_at"), datetime):
            appt["created_at"] = appt["created_at"].isoformat()
        if isinstance(appt.get("updated_at"), datetime):
            appt["updated_at"] = appt["updated_at"].isoformat()

        await sse_manager.broadcast("appointment_updated", appt)
        return appt

    async def reschedule_appointment(
        self, reference: str, phone_verification: str, new_date: str, new_start_time: str, doctor_id: Optional[str] = None
    ) -> Dict[str, Any]:
        appt = await self.lookup_appointment(reference, phone_verification)
        db = get_database()
        
        target_doc_id = doctor_id or appt.get("doctor_id")
        
        # Verify slot is not booked
        conflict = await db.appointments.find_one({
            "appointment_date": new_date,
            "start_time": new_start_time,
            "doctor_id": target_doc_id,
            "status": {"$in": [AppointmentStatus.CONFIRMED.value, AppointmentStatus.PENDING.value]},
            "reference": {"$ne": reference.strip().upper()}
        })
        if conflict:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Slot {new_start_time} on {new_date} is already taken. Please choose another slot."
            )

        # Calculate new end time (30 mins default)
        start_dt = datetime.strptime(new_start_time, "%H:%M")
        new_end_time = (start_dt + timedelta(minutes=30)).strftime("%H:%M")
        now = datetime.utcnow()

        update_payload = {
            "appointment_date": new_date,
            "start_time": new_start_time,
            "end_time": new_end_time,
            "status": AppointmentStatus.RESCHEDULED.value,
            "updated_at": now
        }
        if target_doc_id:
            update_payload["doctor_id"] = target_doc_id

        await db.appointments.update_one(
            {"reference": reference.strip().upper()},
            {"$set": update_payload}
        )

        appt.update(update_payload)
        appt["updated_at"] = now.isoformat()

        if isinstance(appt.get("created_at"), datetime):
            appt["created_at"] = appt["created_at"].isoformat()
        if isinstance(appt.get("updated_at"), datetime):
            appt["updated_at"] = appt["updated_at"].isoformat()

        await sse_manager.broadcast("appointment_updated", appt)
        return appt

appointment_service = AppointmentService()
