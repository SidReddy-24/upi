"""API Router Registry aggregating all v1 sub-routers."""
from fastapi import APIRouter
from app.api.v1 import score, feedback, risk, analytics, model, health

api_router = APIRouter()

api_router.include_router(score.router, tags=["Scoring"])
api_router.include_router(feedback.router, tags=["Feedback"])
api_router.include_router(risk.router, tags=["Risk Query"])
api_router.include_router(analytics.router, tags=["Analytics"])
api_router.include_router(model.router, tags=["Model Registry"])
api_router.include_router(health.router, tags=["System Health"])
