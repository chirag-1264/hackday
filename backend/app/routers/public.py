from fastapi import APIRouter, HTTPException, Query, status
from typing import List, Optional, Dict, Any
from bson import ObjectId
from datetime import datetime

from app.database import get_database
from app.models.clinic import ClinicInDB
from app.models.doctor import DoctorInDB
from app.models.appointment import AppointmentCreate, AppointmentReschedule
from app.services.appointment_service import appointment_service
from app.config import settings

router = APIRouter(prefix="/api", tags=["Public Patient APIs"])

@router.get("/health")
async def health_check():
    db = get_database()
    mongo_ok = False
    try:
        await db.command("ping")
        mongo_ok = True
    except Exception:
        pass

    return {
        "status": "healthy" if mongo_ok else "degraded",
        "timestamp": datetime.utcnow().isoformat(),
        "database": {"connected": mongo_ok, "name": settings.DATABASE_NAME},
        "gemma": {"model": settings.GEMMA_MODEL_NAME, "mode": settings.GEMMA_MODE},
        "telephony": {"demo_mode": settings.TWILIO_DEMO_MODE, "provider": "Twilio Voice"},
        "emergency_number": settings.EMERGENCY_NUMBER
    }

@router.get("/clinics")
async def list_clinics(
    search: Optional[str] = None,
    city: Optional[str] = None,
    specialty: Optional[str] = None
):
    db = get_database()
    query: Dict[str, Any] = {"active": True}

    if city:
        query["city"] = {"$regex": f"^{city}$", "$options": "i"}

    if specialty:
        query["specialties"] = {"$regex": specialty, "$options": "i"}

    if search:
        search_rgx = {"$regex": search, "$options": "i"}
        query["$or"] = [
            {"name": search_rgx},
            {"city": search_rgx},
            {"address": search_rgx},
            {"specialties": search_rgx}
        ]

    cursor = db.clinics.find(query).sort("name", 1)
    clinics = await cursor.to_list(length=100)
    for c in clinics:
        c["_id"] = str(c["_id"])
    return clinics

@router.get("/clinics/{clinic_id}")
async def get_clinic(clinic_id: str):
    db = get_database()
    query = {"$or": [{"_id": clinic_id}]}
    if ObjectId.is_valid(clinic_id):
        query["$or"].append({"_id": ObjectId(clinic_id)})

    clinic = await db.clinics.find_one(query)
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    clinic["_id"] = str(clinic["_id"])
    return clinic

@router.get("/clinics/{clinic_id}/doctors")
async def get_clinic_doctors(clinic_id: str, specialty: Optional[str] = None):
    db = get_database()
    query: Dict[str, Any] = {
        "active": True,
        "$or": [
            {"clinic_id": clinic_id},
            {"clinic_id": ObjectId(clinic_id)} if ObjectId.is_valid(clinic_id) else {"clinic_id": clinic_id}
        ]
    }
    if specialty:
        query["specialty"] = {"$regex": f"^{specialty}$", "$options": "i"}

    cursor = db.doctors.find(query)
    doctors = await cursor.to_list(length=100)
    for d in doctors:
        d["_id"] = str(d["_id"])
    return doctors

@router.get("/availability")
async def get_availability(
    clinic_id: str,
    date: str,
    specialty: Optional[str] = None,
    doctor_id: Optional[str] = None
):
    slots = await appointment_service.get_available_slots(
        clinic_id=clinic_id,
        appointment_date=date,
        specialty=specialty,
        doctor_id=doctor_id
    )
    return {"clinic_id": clinic_id, "date": date, "slots": slots}

@router.post("/appointments", status_code=status.HTTP_201_CREATED)
async def create_appointment(payload: AppointmentCreate):
    appt = await appointment_service.create_appointment(payload)
    return {
        "message": "Appointment booked successfully",
        "reference": appt["reference"],
        "appointment": appt
    }

@router.get("/appointments/lookup/{reference}")
async def lookup_appointment(reference: str, phone: str = Query(..., description="Patient verification phone or last 4 digits")):
    appt = await appointment_service.lookup_appointment(reference=reference, phone_verification=phone)
    return appt

@router.post("/appointments/{reference}/cancel")
async def cancel_appointment(reference: str, phone: str = Query(..., description="Patient verification phone or last 4 digits")):
    appt = await appointment_service.cancel_appointment(reference=reference, phone_verification=phone)
    return {"message": "Appointment cancelled successfully", "appointment": appt}

@router.post("/appointments/{reference}/reschedule")
async def reschedule_appointment(
    reference: str,
    payload: AppointmentReschedule,
    phone: str = Query(..., description="Patient verification phone or last 4 digits")
):
    appt = await appointment_service.reschedule_appointment(
        reference=reference,
        phone_verification=phone,
        new_date=payload.new_date,
        new_start_time=payload.new_start_time,
        doctor_id=payload.doctor_id
    )
    return {"message": "Appointment rescheduled successfully", "appointment": appt}
