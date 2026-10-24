import logging
from fastapi import APIRouter, Request, Response, Form, HTTPException, status
from pydantic import BaseModel
from typing import Optional, Dict, Any
from app.services.ivr_service import ivr_service
from app.models.ivr import IVRSimulateRequest, IVRSimulateResponse
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ivr", tags=["Twilio Voice IVR"])

class OutboundCallRequest(BaseModel):
    to_phone: str
    clinic_id: Optional[str] = None

def get_base_url(request: Request) -> str:
    """
    Returns the public HTTPS base URL for Twilio webhook callbacks.
    Prioritizes PUBLIC_WEBHOOK_URL from environment (crucial for Render / ngrok reverse proxies).
    """
    if settings.PUBLIC_WEBHOOK_URL:
        return settings.PUBLIC_WEBHOOK_URL.strip().rstrip("/")
    
    # Respect reverse-proxy forwarded headers
    proto = request.headers.get("x-forwarded-proto", request.url.scheme)
    host = request.headers.get("x-forwarded-host", request.headers.get("host", request.url.netloc))
    if host:
        return f"{proto}://{host}".rstrip("/")
    return str(request.base_url).rstrip("/")

async def validate_twilio_request(request: Request, form_data: Dict[str, Any]):
    """
    Validates that incoming webhook genuinely originates from Twilio.
    Only active when TWILIO_VERIFY_SIGNATURE=true.
    """
    if not settings.TWILIO_VERIFY_SIGNATURE:
        return
    
    if not settings.TWILIO_AUTH_TOKEN:
        logger.warning("Twilio signature verification enabled but TWILIO_AUTH_TOKEN is not configured.")
        return

    try:
        from twilio.request_validator import RequestValidator
        validator = RequestValidator(settings.TWILIO_AUTH_TOKEN)
        signature = request.headers.get("X-Twilio-Signature", "")
        url = str(request.url)
        # Use public base URL if configured to match the public URL Twilio signed
        if settings.PUBLIC_WEBHOOK_URL:
            url = f"{settings.PUBLIC_WEBHOOK_URL.rstrip('/')}{request.url.path}"
            if request.url.query:
                url = f"{url}?{request.url.query}"
                
        is_valid = validator.validate(url, form_data, signature)
        if not is_valid:
            logger.warning(f"Invalid Twilio Signature from IP {request.client.host}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Invalid Twilio signature."
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error checking Twilio signature: {e}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Signature validation error."
        )

@router.post("/incoming")
async def ivr_incoming(request: Request, CallSid: Optional[str] = Form(None), From: Optional[str] = Form(None)):
    form_data = await request.form()
    await validate_twilio_request(request, dict(form_data))

    call_sid = CallSid or "sim-" + str(id(request))
    caller_phone = From or "+919876543210"
    
    await ivr_service.get_or_create_session(call_sid, caller_phone)
    base_url = get_base_url(request)
    twiml = ivr_service.generate_welcome_twiml(action_url=f"{base_url}/api/ivr/process")
    
    return Response(content=twiml, media_type="application/xml")

@router.post("/process")
async def ivr_process(
    request: Request,
    CallSid: Optional[str] = Form(None),
    SpeechResult: Optional[str] = Form(None),
    Digits: Optional[str] = Form(None)
):
    form_data = await request.form()
    await validate_twilio_request(request, dict(form_data))

    call_sid = CallSid or "demo-session"
    base_url = get_base_url(request)
    
    result = await ivr_service.process_turn(
        call_sid=call_sid,
        speech_result=SpeechResult or "",
        digits=Digits or "",
        base_url=base_url
    )
    
    return Response(content=result["twiml"], media_type="application/xml")

@router.post("/outbound-call")
async def initiate_outbound_call(payload: OutboundCallRequest, request: Request):
    """
    Initiates an outbound phone call from the configured Twilio number to a recipient.
    Connects the answered call directly to the SwasthyaCall conversational AI IVR webhook.
    """
    to_phone = payload.to_phone.strip()
    if not to_phone:
        raise HTTPException(status_code=400, detail="Target phone number (to_phone) is required.")

    base_url = get_base_url(request)
    webhook_url = f"{base_url}/api/ivr/incoming"

    if settings.TWILIO_DEMO_MODE or not (settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN and settings.TWILIO_PHONE_NUMBER):
        return {
            "mode": "demo",
            "status": "simulated",
            "message": "Demo mode active. In production, configure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER, and TWILIO_DEMO_MODE=false to place real carrier calls.",
            "to_phone": to_phone,
            "from_phone": settings.TWILIO_PHONE_NUMBER or "+1-SIMULATED",
            "webhook_url": webhook_url
        }

    try:
        from twilio.rest import Client
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        
        call = client.calls.create(
            to=to_phone,
            from_=settings.TWILIO_PHONE_NUMBER,
            url=webhook_url,
            status_callback=f"{base_url}/api/ivr/status"
        )
        
        logger.info(f"Outbound Twilio call initiated to {to_phone}, CallSid: {call.sid}")
        return {
            "mode": "live",
            "status": call.status,
            "call_sid": call.sid,
            "to_phone": to_phone,
            "from_phone": settings.TWILIO_PHONE_NUMBER,
            "webhook_url": webhook_url
        }
    except Exception as e:
        logger.error(f"Failed to initiate Twilio outbound call: {e}")
        raise HTTPException(
            status_code=502,
            detail=f"Twilio Outbound Call Error: {str(e)}"
        )

@router.post("/fallback")
async def ivr_fallback():
    twiml = """<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="Polly.Aditi" language="hi-IN">Kripya kshama karein, system mein takneeki kharabi aayi hai. Kripya thodi der baad prayas karein. Alvida.</Say>
    <Hangup/>
</Response>"""
    return Response(content=twiml, media_type="application/xml")

@router.post("/status")
async def ivr_status(CallSid: Optional[str] = Form(None), CallStatus: Optional[str] = Form(None)):
    logger.info(f"Twilio Call Status Callback: SID={CallSid}, Status={CallStatus}")
    return {"status": "received"}

@router.post("/simulate", response_model=IVRSimulateResponse)
async def simulate_ivr_call(payload: IVRSimulateRequest, request: Request):
    """
    Browser-based IVR simulation endpoint.
    Processes natural spoken or typed user input through the same Gemma 4 and IVR state machine.
    """
    session = await ivr_service.get_or_create_session(payload.session_id, payload.caller_phone or "+919876543210")
    if payload.language and session.get("step") == "welcome":
        session["language"] = payload.language
        await ivr_service.update_session(payload.session_id, {"language": payload.language})

    base_url = get_base_url(request)
    result = await ivr_service.process_turn(
        call_sid=payload.session_id,
        speech_result=payload.user_input,
        digits=payload.user_input if payload.user_input.isdigit() else "",
        base_url=base_url
    )

    refreshed_session = await ivr_service.get_or_create_session(payload.session_id)

    # Determine suggested quick-replies / options for UI simulator
    options = []
    current_step = refreshed_session.get("step")
    if current_step == "welcome":
        options = ["1 (English)", "2 (Hindi)"]
    elif current_step == "gather_intent":
        if refreshed_session.get("language") == "hi":
            options = ["Mujhe kal bukhar ke liye doctor chahiye", "General physician appointment kal subah", "Seene mein bahut dard ho raha hai"]
        else:
            options = ["Book General Physician tomorrow morning", "I need a Cardiologist on Friday", "Severe chest pain emergency"]
    elif current_step == "offer_slots":
        options = ["1 (Select First Slot)", "2 (Select Second Slot)"]

    from app.services.gemma_service import gemma_service

    return IVRSimulateResponse(
        session_id=payload.session_id,
        step=result.get("step") or refreshed_session.get("step", "welcome"),
        bot_response=result.get("bot_response", "Thank you."),
        audio_hint=refreshed_session.get("language", "en"),
        detected_intent=refreshed_session.get("intent"),
        extracted_entities={
            "clinic": refreshed_session.get("clinic_name"),
            "specialty": refreshed_session.get("specialty"),
            "preferred_date": refreshed_session.get("preferred_date"),
            "preferred_time": refreshed_session.get("preferred_time")
        },
        options=options,
        appointment_created=result.get("appointment_created"),
        is_emergency=result.get("is_emergency", False),
        twiml_preview=result.get("twiml"),
        active_model=result.get("active_model", gemma_service.model_name),
        provider=result.get("provider", gemma_service.provider),
        model_version=result.get("model_version", f"{gemma_service.provider.upper()}: {gemma_service.model_name}"),
        error=result.get("error")
    )
