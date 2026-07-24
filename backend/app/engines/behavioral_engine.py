"""Behavioral Analytics Engine computing statistical deviations from user profile baselines."""
import logging
from typing import Dict, Any, List
from app.models.transaction import TransactionRequest
from app.engines.adaptive_profile_engine import adaptive_profile_engine, AdaptiveBehaviorResult

logger = logging.getLogger("fraudshield.behavior")


class BehaviorResult:
    def __init__(self, deviation_score: float, anomalous_dimensions: list[str], dimension_scores: dict[str, float], context_flags: list[str] = None):
        self.deviation_score = deviation_score
        self.anomalous_dimensions = anomalous_dimensions
        self.dimension_scores = dimension_scores
        self.context_flags = context_flags or []


def compute_behavioral_deviation(transaction: TransactionRequest, profile: dict) -> BehaviorResult:
    """
    Delegates behavioral scoring to AdaptiveProfileEngine for context-aware, low-false-positive evaluation.
    """
    try:
        res: AdaptiveBehaviorResult = adaptive_profile_engine.compute_adaptive_deviation(transaction, profile)
        return BehaviorResult(
            deviation_score=res.deviation_score,
            anomalous_dimensions=res.anomalous_dimensions,
            dimension_scores=res.dimension_scores,
            context_flags=res.context_flags
        )
    except Exception as e:
        logger.error(f"Error computing adaptive behavioral deviation: {str(e)}")
        return BehaviorResult(
            deviation_score=0.05,
            anomalous_dimensions=[],
            dimension_scores={"amount": 0.0, "timing": 0.0, "location": 0.0, "receiver": 0.0},
            context_flags=["FALLBACK_SAFE"]
        )
