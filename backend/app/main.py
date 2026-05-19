"""
CellGene Tracker — FastAPI application entry point.
"""
from __future__ import annotations

import time
import uuid
import logging

import structlog
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
settings = get_settings()
from app.database import engine
from app.models import Base
from app.routers import therapies, users, institutions, watchlists, operational, ingestion

logger = structlog.get_logger(__name__)


# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------

def create_app() -> FastAPI:
    app = FastAPI(
        title="CellGene Tracker API",
        version="1.0.0",
        description="Cell & gene therapy pipeline tracking platform",
        docs_url="/api/docs" if settings.environment != "production" else None,
        redoc_url="/api/redoc" if settings.environment != "production" else None,
        openapi_url="/api/openapi.json" if settings.environment != "production" else None,
    )

    # ---- CORS ----------------------------------------------------------------
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins or settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ---- Trusted hosts -------------------------------------------------------
    if settings.environment == "production":
        app.add_middleware(
            TrustedHostMiddleware,
            allowed_hosts=["*"],
        )

    # ---- Request ID + timing middleware -------------------------------------
    @app.middleware("http")
    async def request_middleware(request: Request, call_next) -> Response:
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        start = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception as exc:
            logger.exception("Unhandled exception", request_id=request_id, exc=str(exc))
            response = JSONResponse(
                status_code=500,
                content={"detail": "Internal server error"},
            )
        elapsed_ms = (time.perf_counter() - start) * 1000
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Response-Time-Ms"] = f"{elapsed_ms:.1f}"
        return response

    # ---- Security headers middleware ----------------------------------------
    @app.middleware("http")
    async def security_headers(request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        if settings.environment == "production":
            response.headers["Strict-Transport-Security"] = (
                "max-age=63072000; includeSubDomains; preload"
            )
        return response

    # ---- Routers -------------------------------------------------------------
    PREFIX = "/api/v1"
    app.include_router(therapies.router, prefix=PREFIX)
    app.include_router(users.router, prefix=PREFIX)
    app.include_router(institutions.router, prefix=PREFIX)
    app.include_router(watchlists.router, prefix=PREFIX)
    app.include_router(operational.router, prefix=PREFIX)
    app.include_router(ingestion.router, prefix=PREFIX)

    # ---- Health check --------------------------------------------------------
    @app.get("/health", tags=["system"])
    async def health():
        return {"status": "ok", "version": "1.0.0", "env": settings.environment}

    # ---- Startup / shutdown --------------------------------------------------
    @app.on_event("startup")
    async def on_startup():
        logger.info("Starting CellGene Tracker API", environment=settings.environment)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables verified")

    @app.on_event("shutdown")
    async def on_shutdown():
        logger.info("Shutting down CellGene Tracker API")
        await engine.dispose()

    return app


app = create_app()
