"""Main FastAPI Application initialization."""
import time
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db.database import engine

# Configure Logging
from app.services.redis_service import redis_service
from app.engines.rule_engine import rule_engine
from app.engines.ml_engine import ml_engine

logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format='{"timestamp": "%(asctime)s", "level": "%(levelname)s", "logger": "%(name)s", "message": "%(message)s"}'
)
logger = logging.getLogger("fraudshield.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}...")
    
    # Initialize Redis
    await redis_service.connect()
    
    # Initialize Rule Engine
    await rule_engine.reload_rules()
    
    # Load ML Models
    ml_engine.load_models()
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
    allow_origins=["*"],  # For hackathon/demo purposes
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
app.include_router(api_router, prefix=settings.API_PREFIX)
