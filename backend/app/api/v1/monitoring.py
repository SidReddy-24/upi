"""
Monitoring API Router.
Surfaces live performance, accuracy metrics, confusion matrices, latency budgets, and model health.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from app.services.monitoring_service import monitoring_service
from app.engines.model_registry import model_registry

router = APIRouter()


@router.get("/metrics", summary="Get model accuracy metrics, confusion matrix & latency")
async def get_metrics():
    """Returns live precision, recall, F1, latency, and confusion matrix."""
    return await monitoring_service.compute_current_metrics()


@router.get("/health", summary="Get model registry health status")
async def get_registry_health():
    """Returns status of primary, backup, and shadow model slots."""
    return model_registry.get_health_report()


@router.post("/hot-reload/{model_id}", summary="Hot reload a model slot without server restart")
async def hot_reload(model_id: str):
    """Hot reloads a specific model slot from disk."""
    success = model_registry.hot_reload(model_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to hot-reload model slot: {model_id}"
        )
    return {"status": "success", "message": f"Slot {model_id} hot-reloaded successfully."}
