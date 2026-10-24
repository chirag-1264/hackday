import asyncio
import logging
from datetime import datetime, timedelta
from app.config import settings
from app.database import connect_to_mongo, close_mongo_connection, get_database
from app.auth.security import hash_password

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("seed")

async def seed_data():
    await connect_to_mongo()
    db = get_database()
    logger.info("Starting SwasthyaCall database seeding...")

    # 1. Clean existing seed collections or check
    await db.clinics.delete_many({"is_demo": True})
    await db.doctors.delete_many({})
    await db.appointments.delete_many({})
    await db.users.delete_many({})

    # 2. Seed Admin User
    admin_user = {
        "email": "admin@swasthyacall.in",
        "full_name": "Dr. Rajesh Sharma (Lead Administrator)",
        "role": "admin",
        "hashed_password": hash_password("Admin@12345"),
        "is_active": True,
        "created_at": datetime.utcnow()
    }
    await db.users.insert_one(admin_user)
    logger.info("Admin user created: admin@swasthyacall.in / Admin@12345")

    # 3. Seed 3 Fictional Demo Clinics
    clinics_data = [
        {
            "name": "Shanti Devi Community Health Centre (Demonstration Clinic)",
            "address": "14 Community Centre Road, Saket",
            "city": "New Delhi",
            "phone": "+91-11-29560001",
            "specialties": ["general_medicine", "cardiology", "pediatrics", "orthopedics"],
            "operating_hours": {
                "open_time": "09:00",
                "close_time": "17:00",
                "days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
            },
            "active": True,
            "is_demo": True,
            "created_at": datetime.utcnow()
        },
        {
            "name": "Arogya Community Clinic (Demonstration Clinic)",
            "address": "88 4th Cross, Indiranagar",
            "city": "Bengaluru",
            "phone": "+91-80-41235678",
            "specialties": ["general_medicine", "dermatology", "pediatrics", "ent"],
            "operating_hours": {
                "open_time": "09:00",
                "close_time": "18:00",
                "days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
            },
            "active": True,
            "is_demo": True,
            "created_at": datetime.utcnow()
        },
        {
            "name": "Sewa Health Clinic (Demonstration Clinic)",
            "address": "205 LBS Marg, Ghatkopar West",
            "city": "Mumbai",
            "phone": "+91-22-25114433",
            "specialties": ["general_medicine", "cardiology", "gynecology", "orthopedics"],
            "operating_hours": {
                "open_time": "08:30",
                "close_time": "17:30",
                "days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
            },
            "active": True,
            "is_demo": True,
            "created_at": datetime.utcnow()
        }
    ]

    inserted_clinics = await db.clinics.insert_many(clinics_data)
    c_ids = [str(i) for i in inserted_clinics.inserted_ids]
    logger.info(f"Seeded {len(c_ids)} fictional clinics.")

    # 4. Seed Doctors for each clinic
    doctors_data = [
        # Delhi Clinic Doctors
        {
            "name": "Dr. Ramesh Verma (Demonstration Doctor)",
            "specialty": "general_medicine",
            "clinic_id": c_ids[0],
            "working_hours": {"start_time": "09:00", "end_time": "17:00", "days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]},
            "appointment_duration_minutes": 30,
            "active": True,
            "languages": ["hi", "en"],
            "created_at": datetime.utcnow()
        },
        {
            "name": "Dr. Priya Sengupta (Demonstration Doctor)",
            "specialty": "cardiology",
            "clinic_id": c_ids[0],
            "working_hours": {"start_time": "10:00", "end_time": "16:00", "days": ["Monday", "Wednesday", "Friday"]},
            "appointment_duration_minutes": 30,
            "active": True,
            "languages": ["hi", "en"],
            "created_at": datetime.utcnow()
        },
        {
            "name": "Dr. Amitava Das (Demonstration Doctor)",
            "specialty": "pediatrics",
            "clinic_id": c_ids[0],
            "working_hours": {"start_time": "09:30", "end_time": "16:30", "days": ["Monday", "Tuesday", "Thursday", "Friday", "Saturday"]},
            "appointment_duration_minutes": 30,
            "active": True,
            "languages": ["hi", "en"],
            "created_at": datetime.utcnow()
        },
        # Bengaluru Clinic Doctors
        {
            "name": "Dr. Ananya Rao (Demonstration Doctor)",
            "specialty": "general_medicine",
            "clinic_id": c_ids[1],
            "working_hours": {"start_time": "09:00", "end_time": "17:00", "days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]},
            "appointment_duration_minutes": 30,
            "active": True,
            "languages": ["en", "hi"],
            "created_at": datetime.utcnow()
        },
        {
            "name": "Dr. Karthik Nair (Demonstration Doctor)",
            "specialty": "dermatology",
            "clinic_id": c_ids[1],
            "working_hours": {"start_time": "10:00", "end_time": "15:00", "days": ["Tuesday", "Wednesday", "Friday", "Saturday"]},
            "appointment_duration_minutes": 30,
            "active": True,
            "languages": ["en", "hi"],
            "created_at": datetime.utcnow()
        },
        # Mumbai Clinic Doctors
        {
            "name": "Dr. Sunil Kulkarni (Demonstration Doctor)",
            "specialty": "general_medicine",
            "clinic_id": c_ids[2],
            "working_hours": {"start_time": "09:00", "end_time": "17:00", "days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]},
            "appointment_duration_minutes": 30,
            "active": True,
            "languages": ["hi", "en"],
            "created_at": datetime.utcnow()
        },
        {
            "name": "Dr. Meenakshi Iyer (Demonstration Doctor)",
            "specialty": "cardiology",
            "clinic_id": c_ids[2],
            "working_hours": {"start_time": "11:00", "end_time": "16:00", "days": ["Monday", "Wednesday", "Friday"]},
            "appointment_duration_minutes": 30,
            "active": True,
            "languages": ["hi", "en"],
            "created_at": datetime.utcnow()
        }
    ]

    inserted_docs = await db.doctors.insert_many(doctors_data)
    d_ids = [str(i) for i in inserted_docs.inserted_ids]
    logger.info(f"Seeded {len(d_ids)} doctors.")

    # 5. Seed Synthetic Appointments with varied statuses and booking sources
    today = datetime.utcnow()
    today_str = today.strftime("%Y-%m-%d")
    tomorrow_str = (today + timedelta(days=1)).strftime("%Y-%m-%d")
    yesterday_str = (today - timedelta(days=1)).strftime("%Y-%m-%d")

    sample_appointments = [
        {
            "reference": "SC-2026-DEMO1",
            "patient_name": "Aarav Gupta (Synthetic Patient)",
            "patient_phone": "+919811001122",
            "clinic_id": c_ids[0],
            "clinic_name": clinics_data[0]["name"],
            "doctor_id": d_ids[0],
            "doctor_name": doctors_data[0]["name"],
            "specialty": "general_medicine",
            "appointment_date": today_str,
            "start_time": "09:30",
            "end_time": "10:00",
            "status": "confirmed",
            "booking_source": "ivr",
            "notes": "Booked via IVR Phone line in Hindi for high fever",
            "notification_status": "simulated",
            "created_at": today - timedelta(hours=3),
            "updated_at": today - timedelta(hours=3)
        },
        {
            "reference": "SC-2026-DEMO2",
            "patient_name": "Sunita Patel (Synthetic Patient)",
            "patient_phone": "+919822334455",
            "clinic_id": c_ids[0],
            "clinic_name": clinics_data[0]["name"],
            "doctor_id": d_ids[1],
            "doctor_name": doctors_data[1]["name"],
            "specialty": "cardiology",
            "appointment_date": today_str,
            "start_time": "11:00",
            "end_time": "11:30",
            "status": "confirmed",
            "booking_source": "website",
            "notes": "Booked via website for routine BP checkup",
            "notification_status": "simulated",
            "created_at": today - timedelta(hours=5),
            "updated_at": today - timedelta(hours=5)
        },
        {
            "reference": "SC-2026-DEMO3",
            "patient_name": "Deepak Mehta (Synthetic Patient)",
            "patient_phone": "+919833445566",
            "clinic_id": c_ids[1],
            "clinic_name": clinics_data[1]["name"],
            "doctor_id": d_ids[3],
            "doctor_name": doctors_data[3]["name"],
            "specialty": "general_medicine",
            "appointment_date": tomorrow_str,
            "start_time": "10:00",
            "end_time": "10:30",
            "status": "pending",
            "booking_source": "ivr",
            "notes": "Booked via IVR Phone line in English",
            "notification_status": "simulated",
            "created_at": today - timedelta(hours=1),
            "updated_at": today - timedelta(hours=1)
        },
        {
            "reference": "SC-2026-DEMO4",
            "patient_name": "Kavita Reddy (Synthetic Patient)",
            "patient_phone": "+919844556677",
            "clinic_id": c_ids[1],
            "clinic_name": clinics_data[1]["name"],
            "doctor_id": d_ids[4],
            "doctor_name": doctors_data[4]["name"],
            "specialty": "dermatology",
            "appointment_date": tomorrow_str,
            "start_time": "14:00",
            "end_time": "14:30",
            "status": "confirmed",
            "booking_source": "website",
            "notes": "Booked via website for skin rash consultation",
            "notification_status": "simulated",
            "created_at": today - timedelta(hours=6),
            "updated_at": today - timedelta(hours=6)
        },
        {
            "reference": "SC-2026-DEMO5",
            "patient_name": "Vikram Chauhan (Synthetic Patient)",
            "patient_phone": "+919855667788",
            "clinic_id": c_ids[2],
            "clinic_name": clinics_data[2]["name"],
            "doctor_id": d_ids[5],
            "doctor_name": doctors_data[5]["name"],
            "specialty": "general_medicine",
            "appointment_date": yesterday_str,
            "start_time": "15:00",
            "end_time": "15:30",
            "status": "completed",
            "booking_source": "website",
            "notes": "Completed consultation successfully",
            "notification_status": "simulated",
            "created_at": today - timedelta(days=2),
            "updated_at": today - timedelta(days=1)
        },
        {
            "reference": "SC-2026-DEMO6",
            "patient_name": "Rohan Deshmukh (Synthetic Patient)",
            "patient_phone": "+919866778899",
            "clinic_id": c_ids[2],
            "clinic_name": clinics_data[2]["name"],
            "doctor_id": d_ids[6],
            "doctor_name": doctors_data[6]["name"],
            "specialty": "cardiology",
            "appointment_date": today_str,
            "start_time": "14:30",
            "end_time": "15:00",
            "status": "cancelled",
            "booking_source": "ivr",
            "notes": "Patient rescheduled to next week",
            "notification_status": "simulated",
            "created_at": today - timedelta(days=1),
            "updated_at": today - timedelta(hours=2)
        }
    ]

    await db.appointments.insert_many(sample_appointments)
    logger.info(f"Seeded {len(sample_appointments)} synthetic appointments (both IVR & Website).")

    await close_mongo_connection()
    logger.info("Database seeding successfully completed!")

if __name__ == "__main__":
    asyncio.run(seed_data())
