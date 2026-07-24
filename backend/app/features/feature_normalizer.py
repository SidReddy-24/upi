"""
Feature Normalizer Module.
Performs z-score normalization and clipping on feature maps.
"""

import numpy as np
from typing import Dict

# Population statistics (mean, std) for online feature scaling
POPULATION_STATS = {
    "txn_amount": (1200.0, 3500.0),
    "vel_txn_count_1h": (1.2, 2.5),
    "vel_amount_sum_24h": (4500.0, 12000.0),
    "geo_distance_from_last_txn_km": (4.5, 25.0),
    "geo_speed_kmh": (15.0, 60.0),
}


class FeatureNormalizer:
    @classmethod
    def normalize(cls, features: Dict[str, float]) -> Dict[str, float]:
        normalized = dict(features)
        for feat, (mean_val, std_val) in POPULATION_STATS.items():
            if feat in normalized and std_val > 0:
                raw = normalized[feat]
                z_score = (raw - mean_val) / std_val
                normalized[f"{feat}_zscore"] = float(np.clip(z_score, -5.0, 5.0))
        return normalized


feature_normalizer = FeatureNormalizer()
