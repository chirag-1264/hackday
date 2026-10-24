import logging
from datetime import datetime
from typing import Optional, Dict, Any
from app.config import settings
from app.database import get_database

logger = logging.getLogger(__name__)

class NotificationService:
    def __init__(self):
        self.twilio_enabled = bool(settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN and settings.TWILIO_PHONE_NUMBER)

    async def send_booking_confirmation(
        self,
        patient_phone: str,
        patient_name: str,
        reference: str,
        clinic_name: str,
        appointment_date: str,
        start_time: str,
        channel: str = "sms"
    ) -> Dict[str, Any]:
        message_body = (
            f"Namaste {patient_name}, your SwasthyaCall appointment is CONFIRMED.\n"
            f"Ref: {reference}\n"
            f"Clinic: {clinic_name}\n"
            f"Date: {appointment_date} at {start_time}\n"
            f"Emergency Helpline: {settings.EMERGENCY_NUMBER}"
        )

        status = "simulated"
        provider_id = None
        error_msg = None

        if self.twilio_enabled and not settings.TWILIO_DEMO_MODE:
            try:
                from twilio.rest import Client
                client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
                msg = client.messages.create(
                    body=message_body,
                    from_=settings.TWILIO_PHONE_NUMBER,
                    to=patient_phone
                )
                status = "sent"
                provider_id = msg.sid
                logger.info(f"Twilio SMS sent to {patient_phone}, SID: {msg.sid}")
            except Exception as e:
                logger.error(f"Twilio SMS dispatch failed: {e}")
                status = "failed"
                error_msg = str(e)
        else:
            logger.info(f"[Demo Mode Notification] SMS simulated for {patient_phone} (Ref: {reference})")

        # Record in notification_logs in MongoDB
        try:
            db = get_database()
            log_entry = {
                "reference": reference,
                "recipient_phone": patient_phone[-4:],  # Mask phone for privacy
                "channel": channel,
                "status": status,
                "provider_id": provider_id,
                "error": error_msg,
                "created_at": datetime.utcnow()
            }
            await db.notification_logs.insert_one(log_entry)
        except Exception as e:
            logger.error(f"Failed to record notification log: {e}")

        return {"status": status, "provider_id": provider_id}

notification_service = NotificationService()
