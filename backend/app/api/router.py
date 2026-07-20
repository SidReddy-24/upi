"""API Router Registry aggregating all v1 sub-routers."""
from fastapi import APIRouter
from app.api.v1 import score, feedback, risk, analytics, model, health, qr_trust, community, assistant, heatmap

api_router = APIRouter()

api_router.include_router(score.router, tags=["Scoring"])
api_router.include_router(feedback.router, tags=["Feedback"])
api_router.include_router(risk.router, tags=["Risk Query"])
api_router.include_router(analytics.router, tags=["Analytics"])
api_router.include_router(model.router, tags=["Model Registry"])
api_router.include_router(health.router, tags=["System Health"])
api_router.include_router(qr_trust.router, tags=["QR Trust"])
api_router.include_router(community.router, tags=["Community Trust"])
api_router.include_router(assistant.router, tags=["AI Scam Assistant"])
api_router.include_router(heatmap.router, tags=["Scam Heatmap"])


