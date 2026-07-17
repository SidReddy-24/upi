"""ML Inference Engine executing LightGBM + Isolation Forest ensemble."""
import os
import logging
import joblib
import numpy as np
import pandas as pd
from app.config import settings

logger = logging.getLogger("fraudshield.ml")

class MLEngine:
    def __init__(self):
        self.lgb_model = None
        self.iso_model = None
        self.shap_explainer = None
        self.feature_cols = []
        self.is_loaded = False

    def load_models(self):
        """Loads serialized ML models from disk."""
        logger.info("Loading ML models from disk...")
        try:
            lgb_path = os.path.join(settings.MODEL_DIR, "lgbm_model.pkl")
            iso_path = os.path.join(settings.MODEL_DIR, "iso_forest_model.pkl")
            shap_path = os.path.join(settings.MODEL_DIR, "shap_explainer.pkl")
            cols_path = os.path.join(settings.MODEL_DIR, "feature_cols.pkl")
            
            if not all(os.path.exists(p) for p in [lgb_path, iso_path, shap_path, cols_path]):
                logger.warning(
                    f"One or more model files missing in {settings.MODEL_DIR}. "
                    "Running ML Engine in degraded mode (mock predictions)."
                )
                self.is_loaded = False
                return

            self.lgb_model = joblib.load(lgb_path)
            self.iso_model = joblib.load(iso_path)
            self.shap_explainer = joblib.load(shap_path)
            self.feature_cols = joblib.load(cols_path)
            
            self.is_loaded = True
            logger.info("ML models loaded successfully.")
        except Exception as e:
            logger.error(f"Error loading ML models: {str(e)}. Running in degraded mode.")
            self.is_loaded = False

    def predict(self, features: dict[str, float]) -> tuple[float, float, dict[str, float]]:
        """
        Executes ensemble prediction: LightGBM + Isolation Forest.
        Returns tuple of (composite_ml_score, isolation_forest_score, shap_values_dict).
        """
        if not self.is_loaded:
            # Degraded/Fallback Mode: simple mock logic based on features
            # Trigger high score for obvious indicators
            lgb_score = 0.05
            if features.get("device_is_rooted", 0) > 0:
                lgb_score += 0.3
            if features.get("geo_is_impossible_travel", 0) > 0:
                lgb_score += 0.4
            if features.get("receiver_is_blacklisted", 0) > 0:
                lgb_score += 0.6
                
            lgb_score = min(lgb_score, 0.99)
            iso_score = 0.8 if lgb_score > 0.5 else 0.1
            
            # Simulated SHAP values
            shap_values = {}
            for k, v in features.items():
                if v > 0 and k in ["device_is_rooted", "geo_is_impossible_travel", "receiver_is_blacklisted", "vel_txn_count_1m"]:
                    shap_values[k] = 0.2
                else:
                    shap_values[k] = 0.0
                    
            ensemble_score = 0.75 * lgb_score + 0.15 * iso_score + 0.10 * (lgb_score)
            return ensemble_score, iso_score, shap_values

        try:
            # Create feature vector matching training columns order
            feat_arr = [features.get(col, 0.0) for col in self.feature_cols]
            X = pd.DataFrame([feat_arr], columns=self.feature_cols)
            
            # 1. LightGBM Prediction
            lgb_score = float(self.lgb_model.predict_proba(X)[0, 1])
            
            # 2. Isolation Forest Prediction
            raw_iso = self.iso_model.score_samples(X)[0]
            # Normalize to [0, 1] (typical range -0.9 anomalous to -0.3 normal)
            # Map -0.8 -> 0.95, -0.4 -> 0.1
            iso_score = float(np.clip(-(raw_iso + 0.3) * 2.0, 0.0, 1.0))
            
            # 3. SHAP Explanations
            # TreeSHAP explainer.shap_values returns list for binary classification
            # shap_values[1] contains contribution to class 1 (fraud)
            shap_res = self.shap_explainer.shap_values(X)
            # Handle different versions of SHAP return structures
            if isinstance(shap_res, list):
                shap_contribs = shap_res[1][0]
            elif len(shap_res.shape) == 3:  # (samples, features, classes)
                shap_contribs = shap_res[0, :, 1]
            else:
                shap_contribs = shap_res[0]
                
            shap_values = dict(zip(self.feature_cols, [float(v) for v in shap_contribs]))
            
            # Ensemble Aggregation (SRD Section 6.4)
            ensemble_score = 0.75 * lgb_score + 0.15 * iso_score + 0.10 * lgb_score
            
            return ensemble_score, iso_score, shap_values
            
        except Exception as e:
            logger.error(f"Error during ML inference: {str(e)}")
            # Fall back to a default low risk score
            return 0.05, 0.05, {}


ml_engine = MLEngine()
