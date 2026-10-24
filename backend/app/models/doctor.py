from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class WorkingHours(BaseModel):
    start_time: str = "09:00"
    end_time: str = "17:00"
    days: List[str] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]

class DoctorBase(BaseModel):
    name: str
    specialty: str
    clinic_id: str
    working_hours: WorkingHours = Field(default_factory=WorkingHours)
    appointment_duration_minutes: int = 30
    active: bool = True
    languages: List[str] = ["en", "hi"]

class DoctorCreate(DoctorBase):
    pass

class DoctorUpdate(BaseModel):
    name: Optional[str] = None
    specialty: Optional[str] = None
    clinic_id: Optional[str] = None
    working_hours: Optional[WorkingHours] = None
    appointment_duration_minutes: Optional[int] = None
    active: Optional[bool] = None
    languages: Optional[List[str]] = None

class DoctorInDB(DoctorBase):
    id: str = Field(alias="_id")
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
