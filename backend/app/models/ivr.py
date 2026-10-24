from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime

class IVRState(BaseModel):
    step: str = "welcome"  # welcome, gather_intent, clarify, offer_slots, confirm, complete, emergency, error
    language: str = "en"   # en, hi
    caller_phone: str = ""
    intent: Optional[str] = None
    clinic_id: Optional[str] = None
    clinic_name: Optional[str] = None
    specialty: Optional[str] = None
    doctor_id: Optional[str] = None
    doctor_name: Optional[str] = None
    preferred_date: Optional[str] = None
    preferred_time: Optional[str] = None
    patient_name: Optional[str] = None
    available_slots: List[Dict[str, Any]] = []
    selected_slot: Optional[Dict[str, Any]] = None
    created_appointment_ref: Optional[str] = None
    emergency_flag: bool = False
    turn_count: int = 0
    history: List[Dict[str, str]] = []

class IVRSessionInDB(IVRState):
    call_sid: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class IVRSimulateRequest(BaseModel):
    session_id: str
    user_input: str
    language: Optional[str] = "en"  # "en" or "hi"
    caller_phone: Optional[str] = "+919876543210"

class IVRSimulateResponse(BaseModel):
    session_id: str
    step: str
    bot_response: str
    audio_hint: Optional[str] = None
    detected_intent: Optional[str] = None
    extracted_entities: Dict[str, Any] = {}
    options: List[str] = []
    appointment_created: Optional[Dict[str, Any]] = None
    is_emergency: bool = False
    twiml_preview: Optional[str] = None
    active_model: Optional[str] = None
    provider: Optional[str] = None
    model_version: Optional[str] = None
    error: Optional[str] = None
