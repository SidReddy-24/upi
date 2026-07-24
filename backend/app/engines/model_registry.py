"""
Model Registry & Version Management Engine.

Provides model lifecycle tracking, hot reloading, health checks,
and fallback model management for machine learning inference.
"""

import os
import logging
import joblib
from datetime import datetime
from typing import Dict, Any, Optional
from pydantic import BaseModel
from app.config import settings

logger = logging.getLogger("fraudshield.model_registry")


class ModelSlot(BaseModel):
    model_id: str
    version: str
    model_type: str  # SUPERVISED_LGBM, ANOMALY_ISO, SHAP_EXPLAINER, SUPERVISED_XGB, SUPERVISED_CAT
    status: str      # HEALTHY, UNLOADED, FAILED
    artifact_path: str
    loaded_at: Optional[datetime] = None
    error_message: Optional[str] = None
    feature_cols: list[str] = []

    class Config:
        arbitrary_types_allowed = True


class ModelRegistry:
    """Central registry managing all active ML model instances."""

    def __init__(self):
        self.primary_lgbm: Optional[Any] = None
        self.iso_model: Optional[Any] = None
        self.shap_explainer: Optional[Any] = None
        self.shadow_xgb: Optional[Any] = None
        self.shadow_cat: Optional[Any] = None
        self.feature_cols: list[str] = []
        
        self.slots: Dict[str, ModelSlot] = {}
        self.is_healthy: bool = False

    def initialize(self):
        """Loads all model artifacts from disk and populates registry slots."""
        # Resolve robust absolute path to ml_models directory
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        model_dir = os.path.join(base_dir, "ml_models")
        logger.info(f"Loading ML models from directory: {model_dir}")

        lgb_path = os.path.join(model_dir, "lgbm_model.pkl")
        iso_path = os.path.join(model_dir, "iso_forest_model.pkl")
        shap_path = os.path.join(model_dir, "shap_explainer.pkl")
        cols_path = os.path.join(model_dir, "feature_cols.pkl")
        xgb_path = os.path.join(model_dir, "xgb_model.pkl")
        cat_path = os.path.join(model_dir, "catboost_model.pkl")

        # 1. Feature Columns
        if os.path.exists(cols_path):
            try:
                self.feature_cols = joblib.load(cols_path)
                logger.info(f"Loaded {len(self.feature_cols)} feature column definitions.")
            except Exception as e:
                logger.error(f"Failed to load feature columns: {e}")

        # 2. Primary LightGBM
        self.slots["lgbm_primary"] = self._load_slot(
            model_id="lgbm_primary",
            version=settings.MODEL_VERSION,
            model_type="SUPERVISED_LGBM",
            path=lgb_path
        )
        if self.slots["lgbm_primary"].status == "HEALTHY":
            self.primary_lgbm = joblib.load(lgb_path)

        # 3. Isolation Forest
        self.slots["iso_forest"] = self._load_slot(
            model_id="iso_forest",
            version=settings.MODEL_VERSION,
            model_type="ANOMALY_ISO",
            path=iso_path
        )
        if self.slots["iso_forest"].status == "HEALTHY":
            self.iso_model = joblib.load(iso_path)

        # 4. SHAP Explainer
        self.slots["shap_explainer"] = self._load_slot(
            model_id="shap_explainer",
            version=settings.MODEL_VERSION,
            model_type="SHAP_EXPLAINER",
            path=shap_path
        )
        if self.slots["shap_explainer"].status == "HEALTHY":
            self.shap_explainer = joblib.load(shap_path)

        # 5. Shadow XGBoost (Optional)
        if os.path.exists(xgb_path):
            self.slots["shadow_xgb"] = self._load_slot("shadow_xgb", "xgb_v1.0", "SUPERVISED_XGB", xgb_path)
            if self.slots["shadow_xgb"].status == "HEALTHY":
                self.shadow_xgb = joblib.load(xgb_path)

        # 6. Shadow CatBoost (Optional)
        if os.path.exists(cat_path):
            self.slots["shadow_cat"] = self._load_slot("shadow_cat", "cat_v1.0", "SUPERVISED_CAT", cat_path)
            if self.slots["shadow_cat"].status == "HEALTHY":
                self.shadow_cat = joblib.load(cat_path)

        # Overall health check
        self.is_healthy = (self.slots.get("lgbm_primary") and self.slots["lgbm_primary"].status == "HEALTHY")
        logger.info(f"Model Registry Initialization Complete. System Healthy: {self.is_healthy}")

    def _load_slot(self, model_id: str, version: str, model_type: str, path: str) -> ModelSlot:
        if not os.path.exists(path):
            return ModelSlot(
                model_id=model_id,
                version=version,
                model_type=model_type,
                status="UNLOADED",
                artifact_path=path,
                error_message="File not found on disk"
            )

        try:
            # Verify file loadable
            _ = joblib.load(path)
            return ModelSlot(
                model_id=model_id,
                version=version,
                model_type=model_type,
                status="HEALTHY",
                artifact_path=path,
                loaded_at=datetime.utcnow(),
                feature_cols=self.feature_cols
            )
        except Exception as e:
            logger.error(f"Error initializing slot {model_id}: {str(e)}")
            return ModelSlot(
                model_id=model_id,
                version=version,
                model_type=model_type,
                status="FAILED",
                artifact_path=path,
                error_message=str(e)
            )

    def get_health_report(self) -> dict[str, Any]:
        """Returns health status report of all slots for monitoring API."""
        return {
            "system_healthy": self.is_healthy,
            "feature_count": len(self.feature_cols),
            "slots": {k: slot.model_dump(mode="json") for k, slot in self.slots.items()}
        }

    def hot_reload(self, model_id: str) -> bool:
        """Hot reloads a specific model slot without restarting server."""
        if model_id not in self.slots:
            logger.warning(f"Unknown model_id: {model_id}")
            return False

        slot = self.slots[model_id]
        logger.info(f"Hot reloading model slot: {model_id} from {slot.artifact_path}")
        new_slot = self._load_slot(slot.model_id, slot.version, slot.model_type, slot.artifact_path)
        self.slots[model_id] = new_slot

        if new_slot.status == "HEALTHY":
            if model_id == "lgbm_primary":
                self.primary_lgbm = joblib.load(slot.artifact_path)
            elif model_id == "iso_forest":
                self.iso_model = joblib.load(slot.artifact_path)
            elif model_id == "shap_explainer":
                self.shap_explainer = joblib.load(slot.artifact_path)
            return True
        return False


model_registry = ModelRegistry()
