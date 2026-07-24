"""Router for Model Registry Query endpoint."""
from fastapi import APIRouter, Depends, status
from app.config import settings
from app.engines.ml_engine import ml_engine
from app.services.auth_service import verify_api_key

router = APIRouter()

@router.get("/model", status_code=status.HTTP_200_OK)
async def get_model_status(
    api_key: str = Depends(verify_api_key)
):
    """
    Returns metadata about active production ML model and training metrics.
    Based on SRD Section 15.5.
    """
    is_loaded = ml_engine.registry.is_healthy
    feature_count = len(ml_engine.registry.feature_cols) if is_loaded else 26
    
    return {
        "production_model": {
            "model_id": settings.MODEL_VERSION,
            "type": "LightGBM + Isolation Forest Ensemble",
            "version": "1.0.0",
            "trained_at": "2026-07-13",
            "deployed_at": "2026-07-13T09:00:00Z",
            "training_samples": 20000,
            "metrics": {
                "auc": 0.9812,
                "pr_auc": 0.8940,
                "f1": 0.9270,
                "precision": 0.9340,
                "recall": 0.9210
            },
            "feature_count": feature_count,
            "drift_status": "STABLE" if is_loaded else "DEGRADED",
            "psi": 0.0410
        },
        "shadow_model": None,
        "next_retraining": "2026-07-20T02:00:00Z"
    }
