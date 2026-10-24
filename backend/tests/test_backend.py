import pytest
import pytest_asyncio
from datetime import datetime, timedelta
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.database import connect_to_mongo, close_mongo_connection
from app.auth.security import create_access_token

@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    await connect_to_mongo()
    yield
    await close_mongo_connection()

@pytest.fixture
def admin_token():
    return create_access_token({"sub": "admin@swasthyacall.in", "role": "admin"})

@pytest.mark.asyncio
async def test_health_check():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["database"]["connected"] is True
        assert data["emergency_number"] == "112"

@pytest.mark.asyncio
async def test_clinics_and_doctors():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/clinics")
        assert resp.status_code == 200
        clinics = resp.json()
        assert len(clinics) >= 3
        
        c_id = clinics[0]["_id"]
        resp_doc = await client.get(f"/api/clinics/{c_id}/doctors")
        assert resp_doc.status_code == 200
        doctors = resp_doc.json()
        assert len(doctors) > 0

@pytest.mark.asyncio
async def test_appointment_booking_and_conflict():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        clinics_resp = await client.get("/api/clinics")
        clinic_id = clinics_resp.json()[0]["_id"]
        
        test_date = (datetime.utcnow() + timedelta(days=2)).strftime("%Y-%m-%d")
        avail_resp = await client.get(f"/api/availability?clinic_id={clinic_id}&date={test_date}&specialty=general_medicine")
        assert avail_resp.status_code == 200
        slots = avail_resp.json()["slots"]
        assert len(slots) > 0
        
        selected_slot = [s for s in slots if s["available"]][0]
        
        booking_payload = {
            "patient_name": "Test Patient",
            "patient_phone": "+919999888877",
            "clinic_id": clinic_id,
            "doctor_id": selected_slot["doctor_id"],
            "specialty": "general_medicine",
            "appointment_date": test_date,
            "start_time": selected_slot["start_time"],
            "end_time": selected_slot["end_time"],
            "booking_source": "website",
            "notes": "Automated unit test booking"
        }
        
        # 1. Book the slot
        book_resp = await client.post("/api/appointments", json=booking_payload)
        assert book_resp.status_code == 201
        created = book_resp.json()
        reference = created["reference"]
        assert reference.startswith("SC-")
        
        # 2. Duplicate booking attempt -> conflict!
        dup_resp = await client.post("/api/appointments", json=booking_payload)
        assert dup_resp.status_code == 409
        
        # 3. Lookup with correct verification
        lookup_resp = await client.get(f"/api/appointments/lookup/{reference}?phone=888877")
        assert lookup_resp.status_code == 200
        assert lookup_resp.json()["reference"] == reference
        
        # 4. Lookup with bad verification
        bad_lookup = await client.get(f"/api/appointments/lookup/{reference}?phone=000000")
        assert bad_lookup.status_code == 401
        
        # 5. Cancel appointment
        cancel_resp = await client.post(f"/api/appointments/{reference}/cancel?phone=888877")
        assert cancel_resp.status_code == 200
        assert cancel_resp.json()["appointment"]["status"] == "cancelled"

@pytest.mark.asyncio
async def test_admin_unauthorized_access():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/admin/dashboard")
        assert resp.status_code == 401
        
        resp_invalid = await client.get("/api/admin/dashboard", headers={"Authorization": "Bearer badtoken"})
        assert resp_invalid.status_code == 401

@pytest.mark.asyncio
async def test_admin_authorized_dashboard(admin_token):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        headers = {"Authorization": f"Bearer {admin_token}"}
        resp = await client.get("/api/admin/dashboard", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "kpis" in data
        assert "trends" in data
        assert "sources" in data

@pytest.mark.asyncio
async def test_ai_gemma_intent_and_emergency():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Hindi request
        resp_hi = await client.post("/api/ai/parse-intent", json={
            "text": "Mujhe kal subah fever ke liye doctor ko dikhana hai",
            "caller_language": "hi"
        })
        assert resp_hi.status_code == 200
        data_hi = resp_hi.json()
        assert data_hi["intent"] == "book_appointment"
        assert data_hi["specialty"] == "general_medicine"
        assert data_hi["is_emergency"] is False
        
        # Red-flag emergency request
        resp_emerg = await client.post("/api/ai/parse-intent", json={
            "text": "Patient is having severe chest pain and cannot breathe",
            "caller_language": "en"
        })
        assert resp_emerg.status_code == 200
        data_emerg = resp_emerg.json()
        assert data_emerg["intent"] == "emergency"
        assert data_emerg["is_emergency"] is True
        assert "112" in data_emerg["emergency_advice"]

@pytest.mark.asyncio
async def test_ivr_simulator_flow():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        session_id = f"test-sim-{int(datetime.utcnow().timestamp())}"
        
        r1 = await client.post("/api/ivr/simulate", json={
            "session_id": session_id,
            "user_input": "1",
            "language": "en"
        })
        assert r1.status_code == 200
        assert r1.json()["step"] == "gather_intent"
        
        test_date = (datetime.utcnow() + timedelta(days=1)).strftime("%Y-%m-%d")
        r2 = await client.post("/api/ivr/simulate", json={
            "session_id": session_id,
            "user_input": "I need general medicine tomorrow",
            "language": "en"
        })
        assert r2.status_code == 200
        assert r2.json()["step"] in ["offer_slots", "clarify"]

@pytest.mark.asyncio
async def test_health_alias_and_outbound_call_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Test root /health alias
        resp_h = await client.get("/health")
        assert resp_h.status_code == 200
        assert resp_h.json()["status"] in ["healthy", "degraded"]

        # Test /api/ivr/outbound-call in demo mode
        resp_call = await client.post("/api/ivr/outbound-call", json={"to_phone": "+919876543210"})
        assert resp_call.status_code == 200
        data = resp_call.json()
        assert data["mode"] == "demo"
        assert data["to_phone"] == "+919876543210"
        assert "webhook_url" in data

