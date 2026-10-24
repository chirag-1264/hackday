from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime

class OperatingHours(BaseModel):
    open_time: str = "09:00"
    close_time: str = "17:00"
    days: List[str] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

class ClinicBase(BaseModel):
    name: str
    address: str
    city: str
    phone: str
    specialties: List[str] = []
    operating_hours: OperatingHours = Field(default_factory=OperatingHours)
    active: bool = True
    is_demo: bool = True

class ClinicCreate(ClinicBase):
    pass

class ClinicUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    phone: Optional[str] = None
    specialties: Optional[List[str]] = None
    operating_hours: Optional[OperatingHours] = None
    active: Optional[bool] = None

class ClinicInDB(ClinicBase):
    id: str = Field(alias="_id")
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
