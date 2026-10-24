from fastapi import APIRouter, HTTPException, status
from typing import Optional, Dict, Any
from pydantic import BaseModel
from app.models.ai import GemmaParseRequest, GemmaNLUResponse
from app.services.gemma_service import gemma_service
from app.database import save_persisted_ai_config

router = APIRouter(prefix="/api/ai", tags=["AI Gemma 4 Adapter"])

class GemmaConfigureRequest(BaseModel):
    api_base: str
    model_name: str
    api_key: Optional[str] = None
    mode: Optional[str] = "online"
    provider: Optional[str] = None

class GemmaTestConnectionRequest(BaseModel):
    api_base: str
    model_name: str
    api_key: Optional[str] = None

@router.get("/status")
async def get_gemma_status():
    """
    Returns safe, non-secret active configuration details.
    The secret API key is NEVER exposed in the response.
    """
    return gemma_service.get_safe_status()

@router.post("/configure")
async def configure_gemma(payload: GemmaConfigureRequest):
    """
    Activates and persists the AI model adapter on the backend.
    Saves to MongoDB so activation survives both page refreshes and server restarts.
    """
    # 1. Update in-memory service
    gemma_service.update_config(
        api_base=payload.api_base,
        model_name=payload.model_name,
        api_key=payload.api_key,
        mode=payload.mode or "online",
        provider=payload.provider
    )

    # 2. Persist to MongoDB
    await save_persisted_ai_config(
        api_base=payload.api_base,
        model_name=payload.model_name,
        api_key=payload.api_key,
        mode=payload.mode or "online",
        provider=gemma_service.provider
    )

    safe_status = gemma_service.get_safe_status()
    return {
        "status": "success",
        "message": f"Successfully activated {gemma_service.provider.upper()} ({payload.model_name})",
        **safe_status
    }

@router.post("/test-connection")
async def test_gemma_connection(payload: GemmaTestConnectionRequest):
    """Tests connection to the configured online or local endpoint."""
    result = await gemma_service.test_connection(
        api_base=payload.api_base,
        model_name=payload.model_name,
        api_key=payload.api_key
    )
    return result

@router.post("/parse-intent", response_model=GemmaNLUResponse)
async def parse_intent_endpoint(payload: GemmaParseRequest):
    try:
        result = await gemma_service.parse_intent_and_entities(
            text=payload.text,
            caller_lang=payload.caller_language,
            current_state=payload.current_state or {}
        )
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(e)
        )
