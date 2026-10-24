from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class GemmaNLUResponse(BaseModel):
    intent: str = "book_appointment"  # book_appointment, emergency, general_info, cancel_reschedule, unknown
    language: str = "en"              # en, hi
    clinic_id: Optional[str] = None
    clinic_name: Optional[str] = None
    specialty: Optional[str] = None
    doctor_name: Optional[str] = None
    preferred_date: Optional[str] = None  # YYYY-MM-DD or relative like tomorrow
    preferred_time: Optional[str] = None  # HH:MM or morning/afternoon
    patient_name: Optional[str] = None
    missing_fields: List[str] = []
    is_emergency: bool = False
    emergency_symptom: Optional[str] = None
    emergency_advice: Optional[str] = None
    next_action: str = "ask_followup"  # ask_followup, query_availability, confirm_booking, escalate_emergency, answer_info
    response_text: str = ""
    confidence: float = 0.95
    model_version: str = "Gemma 4"

class GemmaParseRequest(BaseModel):
    text: str
    caller_language: Optional[str] = "en"
    current_state: Optional[Dict[str, Any]] = None
