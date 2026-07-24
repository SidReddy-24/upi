"""
Population Stability Index (PSI) Feature Drift Detection Engine.
Calculates distribution shift across scoring features.
"""

import numpy as np
import logging
from typing import Dict, List, Any

logger = logging.getLogger("fraudshield.drift_detector")


class DriftDetector:
    @classmethod
    def calculate_psi(cls, baseline: List[float], current: List[float], num_buckets: int = 10) -> float:
        """Computes Population Stability Index (PSI) between baseline and current distributions."""
        if not baseline or not current:
            return 0.0

        try:
            b_arr = np.array(baseline)
            c_arr = np.array(current)

            quantiles = np.linspace(0, 100, num_buckets + 1)
            bins = np.percentile(b_arr, quantiles)
            bins = np.unique(bins)

            if len(bins) < 2:
                return 0.0

            b_counts, _ = np.histogram(b_arr, bins=bins)
            c_counts, _ = np.histogram(c_arr, bins=bins)

            b_pct = b_counts / float(len(b_arr)) + 1e-4
            c_pct = c_counts / float(len(c_arr)) + 1e-4

            psi = np.sum((c_pct - b_pct) * np.log(c_pct / b_pct))
            return float(psi)
        except Exception as e:
            logger.error(f"Error calculating PSI: {e}")
            return 0.0


drift_detector = DriftDetector()
