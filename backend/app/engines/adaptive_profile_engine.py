"""
Adaptive Behavioral Profile Engine.

Replaces static z-score thresholds with dynamic context awareness:
- Salary day detection (suppresses false positives on 1st/last 5 days of month)
- Travel mode detection (suppresses location jumps during multi-day travel)
- Festival calendar awareness (adjusts threshold for major Indian festivals)
- Receiver trust scoring (reduces penalty for repeat payees)
"""

import logging
from datetime import datetime
from typing import Dict, Any, List, Optional
from app.models.transaction import TransactionRequest
from app.engines.population_priors import population_priors, CohortProfile
from app.utils.geo import haversine

logger = logging.getLogger("fraudshield.adaptive_behavior")


# Major Indian Festival Calendar Windows (MM-DD ranges)
FESTIVAL_WINDOWS = [
    (10, 15, 11, 15),  # Diwali / Dhanteras / Bhai Dooj window (Oct-Nov)
    (3, 10, 3, 30),    # Holi window (March)
    (8, 15, 9, 10),    # Ganesh Chaturthi / Onam (Aug-Sept)
    (12, 20, 12, 31),  # Year-end / Christmas (Dec)
]


class AdaptiveBehaviorResult:
    def __init__(self, deviation_score: float, anomalous_dimensions: List[str], dimension_scores: Dict[str, float], context_flags: List[str]):
        self.deviation_score = deviation_score
        self.anomalous_dimensions = anomalous_dimensions
        self.dimension_scores = dimension_scores
        self.context_flags = context_flags


class AdaptiveProfileEngine:
    """Computes behavioral deviation with full context awareness."""

    def is_salary_window(self, dt: datetime) -> bool:
        """Returns True if transaction falls within salary credit window (28th-5th)."""
        day = dt.day
        return day >= 28 or day <= 5

    def is_festival_window(self, dt: datetime) -> bool:
        """Returns True if date falls within major Indian festival periods."""
        m, d = dt.month, dt.day
        for start_m, start_d, end_m, end_d in FESTIVAL_WINDOWS:
            if (start_m == m and d >= start_d) or (end_m == m and d <= end_d) or (start_m < m < end_m):
                return True
        return False

    def compute_adaptive_deviation(self, transaction: TransactionRequest, raw_profile: Dict[str, Any]) -> AdaptiveBehaviorResult:
        context_flags = []
        txn = transaction
        dt = txn.timestamp

        # 1. Resolve Profile or Cold-Start Cohort Prior
        txns_count = int(raw_profile.get("total_txns", 0) or 0)
        prior = population_priors.get_prior(raw_profile.get("city_tier"))

        if txns_count < 5:
            # 100% Cohort Prior
            avg_amt = prior.avg_amount_30d
            std_amt = prior.std_amount_30d
            home_lat = txn.location.latitude if txn.location else 12.9716
            home_lon = txn.location.longitude if txn.location else 77.5946
            home_radius = prior.home_radius_km
            context_flags.append("COLD_START_POPULATION_PRIOR")
        elif txns_count < 30:
            # Blended Profile (80% Prior + 20% Personal)
            p_avg = float(raw_profile.get("avg_amount_30d", prior.avg_amount_30d) or prior.avg_amount_30d)
            avg_amt = 0.80 * prior.avg_amount_30d + 0.20 * p_avg
            std_amt = prior.std_amount_30d
            home_lat = float(raw_profile.get("home_lat", txn.location.latitude if txn.location else 12.9716))
            home_lon = float(raw_profile.get("home_lon", txn.location.longitude if txn.location else 77.5946))
            home_radius = prior.home_radius_km
            context_flags.append("PARTIAL_COLD_START_BLEND")
        else:
            # Full Personal Profile
            avg_amt = float(raw_profile.get("avg_amount_30d", prior.avg_amount_30d) or prior.avg_amount_30d)
            std_amt = float(raw_profile.get("std_amount_30d", prior.std_amount_30d) or prior.std_amount_30d)
            home_lat = float(raw_profile.get("home_lat", 0.0) or 0.0)
            home_lon = float(raw_profile.get("home_lon", 0.0) or 0.0)
            home_radius = float(raw_profile.get("home_radius_km", 15.0) or 15.0)

        # 2. Context Adjustments (Salary, Festival, Travel)
        is_salary = self.is_salary_window(dt)
        is_festival = self.is_festival_window(dt)

        if is_salary:
            context_flags.append("SALARY_WINDOW_ACTIVE")
            avg_amt *= 1.8  # Allow higher spending on salary days without penalty
        if is_festival:
            context_flags.append("FESTIVAL_SEASON_BOOST")
            avg_amt *= 2.5  # Allow festive shopping

        # 3. Calculate Dimensions
        dimension_scores = {}

        # A. Amount Deviation
        if avg_amt > 0 and std_amt > 0:
            z_amount = (txn.amount - avg_amt) / std_amt
            amt_dev = min(1.0, max(0.0, (abs(z_amount) - 1.2) / 3.5))
            # Apply context discount
            if is_salary or is_festival:
                amt_dev *= 0.4
            dimension_scores["amount"] = float(amt_dev)
        else:
            dimension_scores["amount"] = 0.0

        # B. Timing Deviation (Circular 24-hour distance)
        avg_hour = float(raw_profile.get("avg_txn_hour_30d", prior.avg_txn_hour_30d))
        std_hour = float(raw_profile.get("std_txn_hour_30d", prior.std_txn_hour_30d))
        txn_hour = float(dt.hour)

        hour_diff = min(abs(txn_hour - avg_hour), 24.0 - abs(txn_hour - avg_hour))
        if std_hour > 0:
            dimension_scores["timing"] = float(min(1.0, (hour_diff / std_hour) / 3.0))
        else:
            dimension_scores["timing"] = 0.0

        # C. Location Deviation (Travel Mode Aware)
        is_travel_mode = bool(raw_profile.get("is_travel_mode", False))
        if is_travel_mode:
            context_flags.append("TRAVEL_MODE_ACTIVE")
            dimension_scores["location"] = 0.05  # Minimal penalty during verified travel
        elif home_lat != 0.0 and home_lon != 0.0 and txn.location:
            dist = haversine(txn.location.latitude, txn.location.longitude, home_lat, home_lon)
            dimension_scores["location"] = float(min(1.0, dist / (home_radius * 5.0 + 1e-9)))
        else:
            dimension_scores["location"] = 0.0

        # D. Receiver Novelty & Trust
        trusted_receivers = raw_profile.get("trusted_receivers", [])
        if txn.receiver_vpa in trusted_receivers:
            dimension_scores["receiver"] = 0.0
            context_flags.append("TRUSTED_RECEIVER")
        else:
            receivers_list = raw_profile.get("receivers_30d", "").split(",")
            is_new = txn.receiver_vpa not in receivers_list
            dimension_scores["receiver"] = 0.4 if is_new else 0.0

        # 4. Weighted Composite
        weights = {"amount": 0.35, "timing": 0.20, "location": 0.30, "receiver": 0.15}
        composite = sum(weights[k] * dimension_scores[k] for k in weights)

        anomalous_dims = [k for k, v in dimension_scores.items() if v > 0.65]

        return AdaptiveBehaviorResult(
            deviation_score=float(min(1.0, max(0.0, composite))),
            anomalous_dimensions=anomalous_dims,
            dimension_scores=dimension_scores,
            context_flags=context_flags
        )


adaptive_profile_engine = AdaptiveProfileEngine()
