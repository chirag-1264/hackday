import logging
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.config import settings

logger = logging.getLogger(__name__)

class Database:
    client: AsyncIOMotorClient = None
    db: AsyncIOMotorDatabase = None

db_instance = Database()

async def connect_to_mongo():
    import re
    masked_uri = re.sub(r"://([^:]+):([^@]+)@", r"://\1:****@", settings.MONGODB_URI)
    logger.info(f"Connecting to MongoDB at {masked_uri}")
    db_instance.client = AsyncIOMotorClient(settings.MONGODB_URI)
    db_instance.db = db_instance.client[settings.DATABASE_NAME]
    
    # Initialize indexes
    await init_indexes()
    
    # Load any persisted AI configuration into gemma_service
    await load_persisted_ai_config()
    logger.info(f"Connected to MongoDB database: {settings.DATABASE_NAME}")

async def close_mongo_connection():
    if db_instance.client:
        logger.info("Closing MongoDB connection")
        db_instance.client.close()

async def init_indexes():
    db = db_instance.db
    
    # 1. Appointments: Unique reference
    await db.appointments.create_index("reference", unique=True)
    
    # 2. Appointments: Atomic double-booking prevention compound index
    try:
        await db.appointments.create_index(
            [("doctor_id", 1), ("appointment_date", 1), ("start_time", 1)],
            unique=True,
            partialFilterExpression={"status": {"$in": ["confirmed", "pending"]}},
            name="uniq_doctor_slot"
        )
    except Exception as e:
        logger.warning(f"Index creation note: {e}")
        
    # 3. Appointments: Search and lookups
    await db.appointments.create_index([("patient_phone", 1), ("reference", 1)])
    await db.appointments.create_index("status")
    await db.appointments.create_index("created_at")
    await db.appointments.create_index("clinic_id")

    # 4. Clinics: active & city
    await db.clinics.create_index([("city", 1), ("active", 1)])
    
    # 5. Doctors: clinic_id & specialty
    await db.doctors.create_index([("clinic_id", 1), ("specialty", 1)])
    
    # 6. Users: email unique
    await db.users.create_index("email", unique=True)
    
    # 7. IVR Sessions: session_id or call_sid
    await db.ivr_sessions.create_index("call_sid", unique=True)

async def load_persisted_ai_config() -> bool:
    """Loads saved AI model settings from MongoDB on server startup so activation survives restarts."""
    try:
        from app.services.gemma_service import gemma_service
        db = db_instance.db
        if db is None:
            return False
        saved = await db.system_settings.find_one({"_id": "ai_config"})
        if saved:
            gemma_service.update_config(
                api_base=saved.get("api_base"),
                model_name=saved.get("model_name"),
                api_key=saved.get("api_key"),
                mode=saved.get("mode"),
                provider=saved.get("provider")
            )
            logger.info(f"Restored persisted AI model configuration: provider={saved.get('provider')}, model={saved.get('model_name')}, mode={saved.get('mode')}")
            return True
        return False
    except Exception as e:
        logger.warning(f"Could not load persisted AI config on startup: {e}")
        return False

async def save_persisted_ai_config(api_base: str, model_name: str, api_key: str = None, mode: str = "online", provider: str = None):
    """Persists active AI model settings to MongoDB."""
    try:
        from datetime import datetime
        db = db_instance.db
        if db is None:
            return
        doc = {
            "api_base": api_base,
            "model_name": model_name,
            "mode": mode,
            "provider": provider,
            "updated_at": datetime.utcnow()
        }
        if api_key is not None:
            doc["api_key"] = api_key
            
        await db.system_settings.update_one(
            {"_id": "ai_config"},
            {"$set": doc},
            upsert=True
        )
        logger.info(f"Persisted AI config to MongoDB: provider={provider}, model={model_name}, mode={mode}")
    except Exception as e:
        logger.error(f"Failed to persist AI config to MongoDB: {e}")

def get_database() -> AsyncIOMotorDatabase:
    return db_instance.db
