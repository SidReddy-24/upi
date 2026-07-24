"""Main FastAPI Application initialization."""
import time
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
import json

from app.config import settings
from app.db.database import engine

# Configure Logging
from app.services.redis_service import redis_service
from app.engines.rule_engine import rule_engine
from app.engines.ml_engine import ml_engine
from app.engines.graph_engine import graph_engine

logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format='{"timestamp": "%(asctime)s", "level": "%(levelname)s", "logger": "%(name)s", "message": "%(message)s"}'
)
logger = logging.getLogger("fraudshield.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}...")
    
    # 1. Initialize Redis
    await redis_service.connect()
    
    # 2. Initialize Rule Engine
    await rule_engine.reload_rules()
    
    # 3. Load ML Models via ModelRegistry
    ml_engine.load_models()
    
    # 4. Restore Graph Persistence
    await graph_engine.restore_from_persistence()
    
    yield
    
    # Shutdown
    logger.info("Shutting down engine...")
    await engine.dispose()
    logger.info("Database connection pool disposed.")

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Real-Time AI Fraud Scoring Engine for UPI Transactions",
    lifespan=lifespan,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi.encoders import jsonable_encoder

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": jsonable_encoder(exc.errors()), "body": jsonable_encoder(exc.body)},
    )

@app.exception_handler(json.decoder.JSONDecodeError)
async def json_decode_exception_handler(request: Request, exc: json.decoder.JSONDecodeError):
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"detail": "Malformed JSON payload"},
    )

# Timing and request logging middleware
@app.middleware("http")
async def add_process_time_and_log(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = (time.time() - start_time) * 1000
    response.headers["X-Process-Time-Ms"] = f"{process_time:.2f}"
    
    logger.info(
        f"Path: {request.url.path} | Method: {request.method} | Status: {response.status_code} | Latency: {process_time:.2f}ms"
    )
    return response

# Root endpoint
@app.get("/")
async def root():
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "active"
    }

from app.api.router import api_router
api_router_prefix = settings.API_PREFIX
app.include_router(api_router, prefix=api_router_prefix)
