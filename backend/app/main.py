import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from app.config import settings
from app.database import connect_to_mongo, close_mongo_connection
from app.routers import public, admin, ivr, ai

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("swasthyacall")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing SwasthyaCall backend...")
    await connect_to_mongo()
    yield
    logger.info("Shutting down SwasthyaCall backend...")
    await close_mongo_connection()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="SwasthyaCall — AI Health IVR & Smart Appointment Management Platform API",
    lifespan=lifespan
)

# Parse CORS allowed origins cleanly
configured_origins = set()

# Process FRONTEND_ORIGIN (supports comma-separated list)
if settings.FRONTEND_ORIGIN:
    for origin in settings.FRONTEND_ORIGIN.split(","):
        cleaned = origin.strip().rstrip("/")
        if cleaned:
            configured_origins.add(cleaned)

# Process ALLOWED_ORIGINS (supports comma-separated list)
if settings.ALLOWED_ORIGINS:
    for origin in settings.ALLOWED_ORIGINS.split(","):
        cleaned = origin.strip().rstrip("/")
        if cleaned:
            configured_origins.add(cleaned)

# Local development defaults
configured_origins.update([
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001"
])

# Permit Vercel preview deployments (e.g. https://swasthyacall-*.vercel.app)
# without wildcard '*' so credentials (Authorization headers) remain secure
vercel_preview_regex = r"^https:\/\/.*\.vercel\.app$"

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(configured_origins),
    allow_origin_regex=vercel_preview_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(public.router)
app.include_router(admin.router)
app.include_router(ivr.router)
app.include_router(ai.router)

# Safe Health Check Endpoint Aliases for Render & Monitoring
@app.get("/")
async def root():
    return {
        "service": "SwasthyaCall AI Health Platform",
        "status": "online",
        "docs": "/docs",
        "health": "/api/health",
        "version": settings.VERSION
    }

@app.get("/health", tags=["Health"])
async def root_health():
    """Alias for /api/health to satisfy default hosting platform health checks."""
    return await public.health_check()

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=settings.SERVER_HOST,
        port=settings.SERVER_PORT,
        reload=settings.ENVIRONMENT == "development"
    )
