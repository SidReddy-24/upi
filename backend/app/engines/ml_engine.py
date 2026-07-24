"""ML Inference Engine executing LightGBM + Isolation Forest ensemble with optional XGBoost/CatBoost shadow models."""
import os
import logging
import numpy as np
import pandas as pd
from typing import Tuple, Dict, Any, Optional

from app.config import settings
from app.engines.model_registry import model_registry

logger = logging.getLogger("fraudshield.ml")


class MLEngine:
    def __init__(self):
        self.registry = model_registry

    def load_models(self):
        """Initializes model registry and loads all model slots."""
        logger.info("Initializing ML Engine via ModelRegistry...")
        self.registry.initialize()

    def predict(self, features: dict[str, float]) -> Tuple[float, float, dict[str, float]]:
        """
        Executes ensemble prediction across healthy model slots.
        Supports LightGBM (primary), Isolation Forest (anomaly), SHAP explainer,
        and optional XGBoost / CatBoost shadow models.
        
        Returns tuple of (composite_ml_score, isolation_forest_score, shap_values_dict).
        """
        if not self.registry.is_healthy or not self.registry.primary_lgbm:
            logger.error("Primary ML model is not healthy! Raising exception for strict safety.")
            raise RuntimeError("Primary LightGBM ML model unavailable. Cannot process transaction in degraded mode.")

        try:
            cols = self.registry.feature_cols
            if not cols:
                cols = list(features.keys())

            # Create feature vector matching training columns order
            feat_arr = [features.get(col, 0.0) for col in cols]
            X = pd.DataFrame([feat_arr], columns=cols)

            # 1. Primary LightGBM Prediction
            lgb_score = float(self.registry.primary_lgbm.predict_proba(X)[0, 1])

            # 2. Shadow Models (XGBoost / CatBoost if present)
            scores = [lgb_score]
            weights = [0.65]

            if self.registry.shadow_xgb:
                try:
                    xgb_score = float(self.registry.shadow_xgb.predict_proba(X)[0, 1])
                    scores.append(xgb_score)
                    weights.append(0.20)
                except Exception as e:
                    logger.warning(f"Shadow XGBoost prediction failed: {e}")

            if self.registry.shadow_cat:
                try:
                    cat_score = float(self.registry.shadow_cat.predict_proba(X)[0, 1])
                    scores.append(cat_score)
                    weights.append(0.15)
                except Exception as e:
                    logger.warning(f"Shadow CatBoost prediction failed: {e}")

            # Weighted average ensemble for supervised models
            supervised_score = float(np.average(scores, weights=weights[:len(scores)]))

            # 3. Isolation Forest Anomaly Score
            iso_score = 0.1
            if self.registry.iso_model:
                try:
                    raw_iso = self.registry.iso_model.score_samples(X)[0]
                    # Map raw anomaly score to [0.0, 1.0]
                    iso_score = float(np.clip(-(raw_iso + 0.3) * 2.0, 0.0, 1.0))
                except Exception as e:
                    logger.warning(f"Isolation forest scoring error: {e}")

            # 4. SHAP Feature Contributions
            shap_values = {}
            if self.registry.shap_explainer:
                try:
                    shap_res = self.registry.shap_explainer.shap_values(X)
                    if isinstance(shap_res, list):
                        shap_contribs = shap_res[1][0]
                    elif len(getattr(shap_res, "shape", ())) == 3:
                        shap_contribs = shap_res[0, :, 1]
                    else:
                        shap_contribs = shap_res[0]

                    shap_values = dict(zip(cols, [float(v) for v in shap_contribs]))
                except Exception as e:
                    logger.warning(f"SHAP explanation generation error: {e}")

            # Composite ML Ensemble Score (0.80 Supervised + 0.20 Anomaly)
            ensemble_score = float(np.clip(0.80 * supervised_score + 0.20 * iso_score, 0.0, 1.0))

            return ensemble_score, iso_score, shap_values

        except Exception as e:
            logger.error(f"Critical error during ML inference execution: {str(e)}")
            raise e


ml_engine = MLEngine()
