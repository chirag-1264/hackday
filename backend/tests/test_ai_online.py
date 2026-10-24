import json
import uuid
import pytest
import pytest_asyncio
import httpx
from httpx import AsyncClient, ASGITransport, Response
from unittest.mock import patch

from app.main import app
from app.database import (
    connect_to_mongo,
    close_mongo_connection,
    get_database,
    load_persisted_ai_config,
)
from app.services.gemma_service import gemma_service

original_httpx_post = httpx.AsyncClient.post


@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    await connect_to_mongo()
    yield
    # Reset gemma_service and MongoDB system_settings after tests
    gemma_service.update_config(
        api_base="https://openrouter.ai/api/v1",
        model_name="gemma-4-it",
        api_key=None,
        mode="mock",
        provider="local",
    )
    db = get_database()
    if db is not None:
        await db.system_settings.delete_one({"_id": "ai_config"})
    await close_mongo_connection()


@pytest.mark.asyncio
async def test_ai_status_endpoint_never_exposes_api_key():
    """
    Requirements 4 & 7:
    Verify that /api/ai/status returns safe active configuration details
    and NEVER exposes the secret API key in responses.
    """
    secret_key = "sk-or-v1-super-secret-key-do-not-leak-998877"

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Configure OpenRouter model
        config_resp = await client.post(
            "/api/ai/configure",
            json={
                "api_base": "https://openrouter.ai/api/v1",
                "model_name": "google/gemma-2-9b-it",
                "api_key": secret_key,
                "mode": "online",
                "provider": "openrouter",
            },
        )
        assert config_resp.status_code == 200
        config_data = config_resp.json()

        # The configure response itself must NOT contain the secret key
        assert "api_key" not in config_data
        assert config_data["has_api_key"] is True
        assert config_data["provider"] == "openrouter"
        assert config_data["model_name"] == "google/gemma-2-9b-it"
        assert config_data["is_online"] is True

        # Now query GET /api/ai/status
        status_resp = await client.get("/api/ai/status")
        assert status_resp.status_code == 200
        status_data = status_resp.json()

        # Verify safe, non-secret fields
        assert "api_key" not in status_data
        assert status_data["has_api_key"] is True
        assert status_data["provider"] == "openrouter"
        assert status_data["model_name"] == "google/gemma-2-9b-it"
        assert status_data["mode"] == "online"
        assert status_data["is_online"] is True
        assert status_data["api_base"] == "https://openrouter.ai/api/v1"


@pytest.mark.asyncio
async def test_activation_persistence_survives_backend_restart():
    """
    Requirements 3 & 9:
    Verify that AI configuration is saved in MongoDB system_settings
    and is restored during backend initialization (simulating server restart).
    """
    test_key = "sk-or-v1-persistence-test-token-554433"

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await client.post(
            "/api/ai/configure",
            json={
                "api_base": "https://openrouter.ai/api/v1",
                "model_name": "google/gemma-2-9b-it",
                "api_key": test_key,
                "mode": "online",
                "provider": "openrouter",
            },
        )

    # 1. Verify directly in MongoDB system_settings collection
    db = get_database()
    saved_doc = await db.system_settings.find_one({"_id": "ai_config"})
    assert saved_doc is not None
    assert saved_doc["model_name"] == "google/gemma-2-9b-it"
    assert saved_doc["api_base"] == "https://openrouter.ai/api/v1"
    assert saved_doc["api_key"] == test_key
    assert saved_doc["provider"] == "openrouter"

    # 2. Simulate backend restart: Wipe in-memory gemma_service state
    gemma_service.api_key = None
    gemma_service.model_name = "default-local"
    gemma_service.mode = "mock"
    gemma_service.provider = "local"

    # 3. Trigger reload routine executed on server startup
    loaded = await load_persisted_ai_config()
    assert loaded is True

    # 4. Assert in-memory state is restored from MongoDB
    assert gemma_service.api_key == test_key
    assert gemma_service.model_name == "google/gemma-2-9b-it"
    assert gemma_service.provider == "openrouter"
    assert gemma_service.mode == "online"
    assert gemma_service.is_online() is True


@pytest.mark.asyncio
async def test_ivr_intent_request_calls_hosted_openrouter_adapter():
    """
    Requirements 3 & 8:
    Verify that after activation, an IVR intent-extraction request invokes the configured
    hosted OpenRouter adapter with correct authorization headers, attribution headers,
    and model payload, and returns the hosted model information.
    """
    test_key = "sk-or-v1-verified-ivr-test-key-8899"
    gemma_service.update_config(
        api_base="https://openrouter.ai/api/v1",
        model_name="google/gemma-2-9b-it",
        api_key=test_key,
        mode="online",
        provider="openrouter",
    )

    mock_llm_json = {
        "intent": "book_appointment",
        "language": "en",
        "clinic_name": "Metro Health Clinic",
        "specialty": "cardiology",
        "preferred_date": "2026-10-30",
        "preferred_time": "10:00",
        "missing_fields": [],
        "next_action": "query_availability",
        "response_text": "I found appointments for cardiology at Metro Health Clinic.",
    }

    mock_openrouter_response = {
        "id": "gen-test-openrouter-id",
        "model": "google/gemma-2-9b-it",
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": f"```json\n{json.dumps(mock_llm_json)}\n```",
                },
                "finish_reason": "stop",
            }
        ],
    }

    captured_requests = []

    async def mock_post(self, url, *args, **kwargs):
        if "openrouter" in str(url) or "chat/completions" in str(url):
            captured_requests.append({"url": str(url), "kwargs": kwargs})
            return Response(status_code=200, json=mock_openrouter_response)
        return await original_httpx_post(self, url, *args, **kwargs)

    with patch.object(httpx.AsyncClient, "post", new=mock_post):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            session_id = f"test-hosted-{uuid.uuid4().hex[:8]}"

            # Turn 1: Welcome & language selection -> sets step to "gather_intent"
            turn1_resp = await client.post(
                "/api/ivr/simulate",
                json={
                    "session_id": session_id,
                    "user_input": "1",
                    "language": "en",
                },
            )
            assert turn1_resp.status_code == 200
            assert turn1_resp.json()["step"] == "gather_intent"

            # Turn 2: Natural language intent request -> executes hosted Gemma adapter
            ivr_resp = await client.post(
                "/api/ivr/simulate",
                json={
                    "session_id": session_id,
                    "user_input": "I need to book a cardiology appointment tomorrow morning",
                    "language": "en",
                },
            )

            assert ivr_resp.status_code == 200
            ivr_data = ivr_resp.json()

            # Verify that the hosted OpenRouter adapter was invoked
            assert len(captured_requests) > 0
            req = captured_requests[0]
            assert "openrouter.ai/api/v1/chat/completions" in req["url"]

            # Verify headers sent to OpenRouter
            headers = req["kwargs"].get("headers", {})
            assert headers.get("Authorization") == f"Bearer {test_key}"
            assert headers.get("HTTP-Referer") == "https://swasthyacall.in"
            assert headers.get("X-Title") == "SwasthyaCall Health IVR"

            # Verify payload sent to OpenRouter
            payload = req["kwargs"].get("json", {})
            assert payload.get("model") == "google/gemma-2-9b-it"

            # Verify that IVR response reports the configured hosted adapter
            assert ivr_data["active_model"] == "google/gemma-2-9b-it"
            assert ivr_data["provider"] == "openrouter"
            assert "OPENROUTER: google/gemma-2-9b-it" in ivr_data["model_version"]
            assert ivr_data["detected_intent"] == "book_appointment"
            assert ivr_data["extracted_entities"]["specialty"] == "cardiology"
            assert ivr_data["error"] is None


@pytest.mark.asyncio
async def test_hosted_model_failure_does_not_silently_fallback():
    """
    Requirement 6:
    If the hosted model fails after activation (e.g. 401 Unauthorized or API down),
    it must NOT silently fall back to local/mock Gemma while claiming the online model is active.
    It must return an explicit error.
    """
    gemma_service.update_config(
        api_base="https://openrouter.ai/api/v1",
        model_name="google/gemma-2-9b-it",
        api_key="sk-or-v1-invalid-key-simulating-failure",
        mode="online",
        provider="openrouter",
    )

    async def mock_failed_post(self, url, *args, **kwargs):
        if "openrouter" in str(url) or "chat/completions" in str(url):
            return Response(
                status_code=401,
                text='{"error": {"message": "Invalid OpenRouter API Key provided", "code": 401}}',
            )
        return await original_httpx_post(self, url, *args, **kwargs)

    with patch.object(httpx.AsyncClient, "post", new=mock_failed_post):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # 1. Test POST /api/ai/parse-intent directly -> Must return 502 with error, NOT 200 with fake response
            intent_resp = await client.post(
                "/api/ai/parse-intent",
                json={"text": "Book an appointment for fever tomorrow", "lang": "en"},
            )
            assert intent_resp.status_code == 502
            err_detail = intent_resp.json()["detail"]
            assert "openrouter" in err_detail.lower()
            assert "401" in err_detail or "error" in err_detail.lower()

            # 2. Test POST /api/ivr/simulate
            session_id = f"test-err-{uuid.uuid4().hex[:8]}"

            # Turn 1: Welcome / language selection
            t1 = await client.post(
                "/api/ivr/simulate",
                json={
                    "session_id": session_id,
                    "user_input": "1",
                    "language": "en",
                },
            )
            assert t1.status_code == 200

            # Turn 2: Intent extraction turn -> triggers hosted API failure without falling back
            ivr_resp = await client.post(
                "/api/ivr/simulate",
                json={
                    "session_id": session_id,
                    "user_input": "I have back pain and need an appointment",
                    "language": "en",
                },
            )
            assert ivr_resp.status_code == 200
            ivr_data = ivr_resp.json()
            assert ivr_data["step"] == "error"
            assert ivr_data["error"] is not None
            assert "openrouter" in ivr_data["error"].lower()
            assert ivr_data["active_model"] == "google/gemma-2-9b-it"
            assert ivr_data["provider"] == "openrouter"
