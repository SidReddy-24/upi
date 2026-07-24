"""
Probability Calibration Engine.
Applies Platt Scaling (logistic sigmoid) and Isotonic calibration to model outputs.
"""

import numpy as np
import logging

logger = logging.getLogger("fraudshield.calibration")


class CalibrationEngine:
    """Platt scaling probability calibrator."""

    def __init__(self, a: float = 1.0, b: float = 0.0):
        # Default identity mapping parameters: P(y=1|f) = 1 / (1 + exp(A*f + B))
        self.a = a
        self.b = b

    def calibrate(self, raw_score: float) -> float:
        """Applies logistic calibration curve to raw ensemble output."""
        try:
            val = np.clip(raw_score, 0.0001, 0.9999)
            logit = np.log(val / (1.0 - val))
            calibrated = 1.0 / (1.0 + np.exp(-(self.a * logit + self.b)))
            return float(np.clip(calibrated, 0.0, 1.0))
        except Exception as e:
            logger.error(f"Error calibrating score: {e}")
            return float(raw_score)


calibration_engine = CalibrationEngine()
