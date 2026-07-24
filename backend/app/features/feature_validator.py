"""
Feature Schema Validation Engine.
Validates incoming raw feature maps against strict ranges and types.
"""

import logging
from typing import Dict, Any, List, Tuple

logger = logging.getLogger("fraudshield.feature_validator")


class FeatureValidator:
    SCHEMA = {
        "txn_amount": {"type": float, "min": 0.0, "max": 200000.0},
        "vel_txn_count_1m": {"type": float, "min": 0.0, "max": 1000.0},
        "vel_txn_count_5m": {"type": float, "min": 0.0, "max": 2000.0},
        "vel_txn_count_1h": {"type": float, "min": 0.0, "max": 5000.0},
        "geo_speed_kmh": {"type": float, "min": 0.0, "max": 10000.0},
        "device_is_rooted": {"type": float, "min": 0.0, "max": 1.0},
        "device_is_emulator": {"type": float, "min": 0.0, "max": 1.0},
        "receiver_is_blacklisted": {"type": float, "min": 0.0, "max": 1.0},
    }

    @classmethod
    def validate_and_clean(cls, features: Dict[str, float]) -> Tuple[Dict[str, float], List[str]]:
        cleaned = dict(features)
        anomalies = []

        for feat, rules in cls.SCHEMA.items():
            if feat in cleaned:
                val = cleaned[feat]
                min_val = rules.get("min", -1e9)
                max_val = rules.get("max", 1e9)

                if val < min_val or val > max_val:
                    anomalies.append(f"Feature {feat} out of range ({val} not in [{min_val}, {max_val}])")
                    cleaned[feat] = float(max(min_val, min(max_val, val)))

        return cleaned, anomalies


feature_validator = FeatureValidator()
