"""
Dynamic Decision Engine.
Replaces static thresholds with dynamic adaptive threshold strategies and business overrides.
"""

import logging
from typing import Dict, Any, Tuple
from app.config import settings

logger = logging.getLogger("fraudshield.decision_engine")


class DecisionEngine:
    """Evaluates final composite risk against adaptive threshold strategies."""

    def evaluate_decision(
        self,
        composite_risk: float,
        confidence: float,
        has_critical_rule: bool = False,
        fraud_ring_flag: bool = False,
        device_risk: float = 0.0
    ) -> Tuple[str, float, str]:
        """
        Returns Tuple of (decision, threshold_used, decision_reason).
        Decisions: APPROVE, REVIEW, REJECT
        """
        # 1. Hard Business Overrides
        if has_critical_rule:
            return "REJECT", 0.95, "Hard override: Critical rule triggered (e.g. Blacklisted VPA)."
        if fraud_ring_flag:
            return "REJECT", 0.90, "Hard override: Sender/Device linked to confirmed fraud ring."
        if device_risk >= 0.85:
            return "REJECT", 0.75, "Hard override: Device integrity compromised (Rooted/Emulator in Mule Ring)."

        # 2. Dynamic Threshold Selection
        # Adapt thresholds based on prediction confidence
        threshold_reject = settings.THRESHOLD_REJECT
        threshold_approve = settings.THRESHOLD_APPROVE

        # If model confidence is low (< 0.70), lower REVIEW threshold to send more to human analyst
        if confidence < 0.70:
            threshold_approve = max(0.20, threshold_approve - 0.10)

        # 3. Decision Evaluation
        if composite_risk >= threshold_reject:
            return "REJECT", threshold_reject, f"Composite risk ({composite_risk:.4f}) exceeds REJECT threshold ({threshold_reject})."
        elif composite_risk >= threshold_approve:
            return "REVIEW", threshold_approve, f"Composite risk ({composite_risk:.4f}) exceeds REVIEW threshold ({threshold_approve})."
        else:
            return "APPROVE", threshold_approve, f"Composite risk ({composite_risk:.4f}) within safe APPROVE boundary."


decision_engine = DecisionEngine()
