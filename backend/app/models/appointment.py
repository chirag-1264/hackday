from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum

class BookingSource(str, Enum):
    WEBSITE = "website"
    IVR = "ivr"

class AppointmentStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    RESCHEDULED = "rescheduled"
    CANCELLED = "cancelled"
    COMPLETED = "completed"

class AppointmentBase(BaseModel):
    patient_name: str
    patient_phone: str
    clinic_id: str
    doctor_id: Optional[str] = None
    specialty: str
    appointment_date: str  # YYYY-MM-DD
    start_time: str        # HH:MM
    end_time: str          # HH:MM
    booking_source: BookingSource = BookingSource.WEBSITE
    notes: Optional[str] = None

class AppointmentCreate(AppointmentBase):
    pass

class AppointmentUpdateStatus(BaseModel):
    status: AppointmentStatus
    notes: Optional[str] = None

class AppointmentReschedule(BaseModel):
    new_date: str
    new_start_time: str
    doctor_id: Optional[str] = None

class AppointmentInDB(AppointmentBase):
    id: str = Field(alias="_id")
    reference: str
    status: AppointmentStatus = AppointmentStatus.CONFIRMED
    notification_status: str = "pending"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    clinic_name: Optional[str] = None
    doctor_name: Optional[str] = None

    class Config:
        populate_by_name = True
