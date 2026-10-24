import asyncio
from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from bson import ObjectId
from sse_starlette.sse import EventSourceResponse

from app.database import get_database
from app.auth.security import verify_password, create_access_token
from app.auth.deps import get_admin_user, get_current_user
from app.models.user import UserLogin, UserInDB, TokenResponse, UserBase
from app.models.appointment import AppointmentUpdateStatus, AppointmentStatus
from app.models.doctor import DoctorCreate, DoctorUpdate
from app.models.clinic import ClinicCreate, ClinicUpdate
from app.services.sse_manager import sse_manager

router = APIRouter(prefix="/api/admin", tags=["Clinic Admin Dashboard"])

@router.post("/login", response_model=TokenResponse)
async def admin_login(payload: UserLogin):
    db = get_database()
    user = await db.users.find_one({"email": payload.email.lower().strip()})
    if not user or not verify_password(payload.password, user.get("hashed_password", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    user["_id"] = str(user["_id"])
    token = create_access_token(data={"sub": user["email"], "role": user.get("role", "staff")})
    
    user_base = UserBase(
        email=user["email"],
        full_name=user.get("full_name", "Clinic Staff"),
        role=user.get("role", "staff"),
        clinic_id=str(user.get("clinic_id", "")),
        is_active=user.get("is_active", True)
    )
    return TokenResponse(access_token=token, user=user_base)

@router.get("/me")
async def get_current_admin(current_user: UserInDB = Depends(get_current_user)):
    return current_user

@router.get("/dashboard")
async def get_dashboard_metrics(current_user: UserInDB = Depends(get_admin_user)):
    db = get_database()
    today_str = datetime.utcnow().strftime("%Y-%m-%d")

    # Counts
    total_today = await db.appointments.count_documents({"appointment_date": today_str})
    confirmed_count = await db.appointments.count_documents({"status": AppointmentStatus.CONFIRMED.value})
    pending_count = await db.appointments.count_documents({"status": AppointmentStatus.PENDING.value})
    cancelled_count = await db.appointments.count_documents({"status": AppointmentStatus.CANCELLED.value})
    completed_count = await db.appointments.count_documents({"status": AppointmentStatus.COMPLETED.value})
    upcoming_count = await db.appointments.count_documents({
        "appointment_date": {"$gte": today_str},
        "status": {"$in": [AppointmentStatus.CONFIRMED.value, AppointmentStatus.PENDING.value]}
    })

    # Sources
    ivr_count = await db.appointments.count_documents({"booking_source": "ivr"})
    website_count = await db.appointments.count_documents({"booking_source": "website"})

    # 7-day trend
    trends = []
    base_date = datetime.utcnow() - timedelta(days=6)
    for i in range(7):
        day_date = (base_date + timedelta(days=i)).strftime("%Y-%m-%d")
        day_display = (base_date + timedelta(days=i)).strftime("%b %d")
        day_total = await db.appointments.count_documents({"appointment_date": day_date})
        day_ivr = await db.appointments.count_documents({"appointment_date": day_date, "booking_source": "ivr"})
        day_web = await db.appointments.count_documents({"appointment_date": day_date, "booking_source": "website"})
        trends.append({
            "date": day_display,
            "total": day_total,
            "ivr": day_ivr,
            "website": day_web
        })

    # Recent activity
    recent_cursor = db.appointments.find().sort("created_at", -1).limit(8)
    recent_appts = await recent_cursor.to_list(length=8)
    for a in recent_appts:
        a["_id"] = str(a["_id"])
        if isinstance(a.get("created_at"), datetime):
            a["created_at"] = a["created_at"].isoformat()
        if isinstance(a.get("updated_at"), datetime):
            a["updated_at"] = a["updated_at"].isoformat()

    return {
        "kpis": {
            "total_today": total_today,
            "confirmed": confirmed_count,
            "pending": pending_count,
            "cancelled": cancelled_count,
            "completed": completed_count,
            "upcoming": upcoming_count,
        },
        "sources": {
            "ivr": ivr_count,
            "website": website_count,
        },
        "trends": trends,
        "recent_activity": recent_appts
    }

@router.get("/appointments")
async def list_appointments(
    current_user: UserInDB = Depends(get_admin_user),
    status: Optional[str] = None,
    clinic_id: Optional[str] = None,
    booking_source: Optional[str] = None,
    date: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 100,
    skip: int = 0
):
    db = get_database()
    query: Dict[str, Any] = {}

    if status:
        query["status"] = status
    if clinic_id:
        query["$or"] = [{"clinic_id": clinic_id}]
        if ObjectId.is_valid(clinic_id):
            query["$or"].append({"clinic_id": ObjectId(clinic_id)})
    if booking_source:
        query["booking_source"] = booking_source
    if date:
        query["appointment_date"] = date
    if search:
        search_rgx = {"$regex": search, "$options": "i"}
        search_or = [
            {"reference": search_rgx},
            {"patient_name": search_rgx},
            {"patient_phone": search_rgx},
            {"specialty": search_rgx}
        ]
        if "$or" in query:
            query = {"$and": [query, {"$or": search_or}]}
        else:
            query["$or"] = search_or

    cursor = db.appointments.find(query).sort("created_at", -1).skip(skip).limit(limit)
    appointments = await cursor.to_list(length=limit)
    for a in appointments:
        a["_id"] = str(a["_id"])
        if isinstance(a.get("created_at"), datetime):
            a["created_at"] = a["created_at"].isoformat()
        if isinstance(a.get("updated_at"), datetime):
            a["updated_at"] = a["updated_at"].isoformat()

    total_count = await db.appointments.count_documents(query)
    return {"total": total_count, "items": appointments}

@router.patch("/appointments/{appointment_id}")
async def update_appointment_status(
    appointment_id: str,
    payload: AppointmentUpdateStatus,
    current_user: UserInDB = Depends(get_admin_user)
):
    db = get_database()
    query = {"$or": [{"_id": appointment_id}]}
    if ObjectId.is_valid(appointment_id):
        query["$or"].append({"_id": ObjectId(appointment_id)})

    appt = await db.appointments.find_one(query)
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")

    now = datetime.utcnow()
    update_data = {
        "status": payload.status.value,
        "updated_at": now
    }
    if payload.notes:
        update_data["notes"] = payload.notes

    await db.appointments.update_one(query, {"$set": update_data})
    
    appt.update(update_data)
    appt["_id"] = str(appt["_id"])
    appt["updated_at"] = now.isoformat()
    if isinstance(appt.get("created_at"), datetime):
        appt["created_at"] = appt["created_at"].isoformat()

    # Broadcast real-time update
    await sse_manager.broadcast("appointment_updated", appt)

    return {"message": "Status updated successfully", "appointment": appt}

@router.post("/doctors", status_code=status.HTTP_201_CREATED)
async def create_doctor(payload: DoctorCreate, current_user: UserInDB = Depends(get_admin_user)):
    db = get_database()
    doc_data = payload.model_dump()
    doc_data["created_at"] = datetime.utcnow()
    res = await db.doctors.insert_one(doc_data)
    doc_data["_id"] = str(res.inserted_id)
    doc_data["created_at"] = doc_data["created_at"].isoformat()
    return doc_data

@router.patch("/doctors/{doctor_id}")
async def update_doctor(doctor_id: str, payload: DoctorUpdate, current_user: UserInDB = Depends(get_admin_user)):
    db = get_database()
    query = {"$or": [{"_id": doctor_id}]}
    if ObjectId.is_valid(doctor_id):
        query["$or"].append({"_id": ObjectId(doctor_id)})

    update_dict = {k: v for k, v in payload.model_dump(exclude_unset=True).items()}
    if not update_dict:
        raise HTTPException(status_code=400, detail="No fields provided for update")

    res = await db.doctors.update_one(query, {"$set": update_dict})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Doctor not found")

    updated_doc = await db.doctors.find_one(query)
    updated_doc["_id"] = str(updated_doc["_id"])
    return updated_doc

@router.post("/clinics", status_code=status.HTTP_201_CREATED)
async def create_clinic(payload: ClinicCreate, current_user: UserInDB = Depends(get_admin_user)):
    db = get_database()
    c_data = payload.model_dump()
    c_data["created_at"] = datetime.utcnow()
    res = await db.clinics.insert_one(c_data)
    c_data["_id"] = str(res.inserted_id)
    c_data["created_at"] = c_data["created_at"].isoformat()
    return c_data

@router.patch("/clinics/{clinic_id}")
async def update_clinic(clinic_id: str, payload: ClinicUpdate, current_user: UserInDB = Depends(get_admin_user)):
    db = get_database()
    query = {"$or": [{"_id": clinic_id}]}
    if ObjectId.is_valid(clinic_id):
        query["$or"].append({"_id": ObjectId(clinic_id)})

    update_dict = {k: v for k, v in payload.model_dump(exclude_unset=True).items()}
    if not update_dict:
        raise HTTPException(status_code=400, detail="No fields provided for update")

    res = await db.clinics.update_one(query, {"$set": update_dict})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Clinic not found")

    updated_clinic = await db.clinics.find_one(query)
    updated_clinic["_id"] = str(updated_clinic["_id"])
    return updated_clinic

@router.get("/events")
async def live_dashboard_events():
    """Server-Sent Events endpoint for real-time dashboard updates."""
    queue = await sse_manager.subscribe()

    async def event_generator():
        try:
            # Send initial connected event
            yield {"event": "connected", "data": "connected to swasthyacall live stream"}
            while True:
                try:
                    # Wait for an event with a 15-second timeout for keep-alive ping
                    message = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield {"event": "message", "data": message}
                except asyncio.TimeoutError:
                    yield {"event": "ping", "data": "keep-alive"}
        except asyncio.CancelledError:
            pass
        finally:
            await sse_manager.unsubscribe(queue)

    return EventSourceResponse(event_generator())
