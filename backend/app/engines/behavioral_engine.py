"""Behavioral Analytics Engine computing statistical deviations from user profile baselines."""
import logging
from app.models.transaction import TransactionRequest
from app.utils.geo import haversine

logger = logging.getLogger("fraudshield.behavior")

class BehaviorResult:
    def __init__(self, deviation_score: float, anomalous_dimensions: list[str], dimension_scores: dict[str, float]):
        self.deviation_score = deviation_score
        self.anomalous_dimensions = anomalous_dimensions
        self.dimension_scores = dimension_scores

def compute_behavioral_deviation(transaction: TransactionRequest, profile: dict) -> BehaviorResult:
    """
    Computes a composite deviation score [0, 1] across behavioral dimensions.
    Based on SRD Section 9.4.
    """
    deviations = {}
    
    # 1. Amount deviation
    try:
        avg_amount = float(profile.get("avg_amount_30d", 0.0) or 0.0)
        std_amount = float(profile.get("std_amount_30d", 0.0) or 0.0)
        
        if avg_amount > 0 and std_amount > 0:
            z_amount = (transaction.amount - avg_amount) / std_amount
            deviations["amount"] = min(1.0, max(0.0, (abs(z_amount) - 1.0) / 3.0))
        else:
            deviations["amount"] = 0.0
    except Exception as e:
        logger.error(f"Error calculating behavioral amount deviation: {str(e)}")
        deviations["amount"] = 0.0

    # 2. Time-of-day deviation
    try:
        avg_hour = float(profile.get("avg_txn_hour_30d", 12.0) or 12.0)
        std_hour = float(profile.get("std_txn_hour_30d", 4.0) or 4.0)
        txn_hour = float(transaction.timestamp.hour)
        
        if std_hour > 0:
            # Hour difference on 24-hour circle
            hour_diff = min(abs(txn_hour - avg_hour), 24.0 - abs(txn_hour - avg_hour))
            z_hour = hour_diff / std_hour
            deviations["timing"] = min(1.0, z_hour / 3.0)
        else:
            deviations["timing"] = 0.0
    except Exception as e:
        logger.error(f"Error calculating behavioral timing deviation: {str(e)}")
        deviations["timing"] = 0.0

    # 3. Location deviation
    try:
        home_lat = float(profile.get("home_lat", 0.0) or 0.0)
        home_lon = float(profile.get("home_lon", 0.0) or 0.0)
        home_radius = float(profile.get("home_radius_km", 15.0) or 15.0)
        
        if home_lat != 0.0 and home_lon != 0.0 and transaction.location:
            distance = haversine(
                transaction.location.latitude,
                transaction.location.longitude,
                home_lat,
                home_lon
            )
            # Normalize to 0-1, scale threshold at home_radius * 5
            deviations["location"] = min(1.0, distance / (home_radius * 5.0 + 1e-9))
        else:
            deviations["location"] = 0.0
    except Exception as e:
        logger.error(f"Error calculating behavioral location deviation: {str(e)}")
        deviations["location"] = 0.0

    # 4. Receiver novelty deviation
    try:
        pct_new_receivers = float(profile.get("pct_new_receivers_7d", 0.1) or 0.1)
        receivers_list = profile.get("receivers_30d", "").split(",")
        is_new_receiver = transaction.receiver_vpa not in receivers_list
        
        if is_new_receiver:
            # If the user rarely transacts with new receivers, the deviation is high
            deviations["receiver"] = max(0.0, 1.0 - pct_new_receivers)
        else:
            deviations["receiver"] = 0.0
    except Exception as e:
        logger.error(f"Error calculating behavioral receiver deviation: {str(e)}")
        deviations["receiver"] = 0.0

    # Weighted composite (SRD Section 9.4)
    weights = {"amount": 0.35, "timing": 0.20, "location": 0.30, "receiver": 0.15}
    composite = sum(weights[k] * deviations[k] for k in weights)
    
    anomalous_dims = [k for k, v in deviations.items() if v > 0.7]
    
    return BehaviorResult(
        deviation_score=composite,
        anomalous_dimensions=anomalous_dims,
        dimension_scores=deviations
    )
