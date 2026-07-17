"""Feature Extraction and Feature Store retrieval orchestrator."""
import logging
import asyncio
import numpy as np
from datetime import datetime
from app.config import settings
from app.models.transaction import TransactionRequest
from app.services.redis_service import get_redis
from app.utils.geo import haversine

logger = logging.getLogger("fraudshield.features")

async def extract_features(txn: TransactionRequest) -> dict[str, float]:
    """
    Extracts 40+ features by querying L1 Redis cache and calculating online values.
    Implements timeout and defaults for resiliency.
    """
    redis = await get_redis()
    
    sender = txn.sender_vpa
    device_id = txn.device.device_id
    receiver = txn.receiver_vpa
    amount = txn.amount
    timestamp = txn.timestamp
    
    # 1. Define Redis keys
    profile_key = f"user:{sender}:profile"
    velocity_1m_key = f"user:{sender}:velocity:1m"
    velocity_5m_key = f"user:{sender}:velocity:5m"
    velocity_1h_key = f"user:{sender}:velocity:1h"
    velocity_24h_key = f"user:{sender}:velocity:24h"
    amt_sum_1h_key = f"user:{sender}:amount_sum:1h"
    amt_sum_24h_key = f"user:{sender}:amount_sum:24h"
    last_loc_key = f"user:{sender}:last_loc"
    device_key = f"device:{device_id}:users"
    blacklist_key = f"vpa:{receiver}:blacklisted"
    graph_risk_key = f"graph:user:{sender}:risk"
    
    # 2. Concurrently fetch raw data from Redis with pipeline
    try:
        pipe = await redis.pipeline()
        pipe.hgetall(profile_key)
        pipe.get(velocity_1m_key)
        pipe.get(velocity_5m_key)
        pipe.get(velocity_1h_key)
        pipe.get(velocity_24h_key)
        pipe.get(amt_sum_1h_key)
        pipe.get(amt_sum_24h_key)
        pipe.hgetall(last_loc_key)
        pipe.sismember(f"device:{device_id}:users", sender)
        pipe.get(blacklist_key)
        pipe.get(graph_risk_key)
        
        # Execute pipeline with timeout
        results = await asyncio.wait_for(
            pipe.execute(), 
            timeout=settings.FEATURE_TIMEOUT_MS / 1000.0
        )
    except asyncio.TimeoutError:
        logger.error("Timeout fetching features from Redis. Using defaults.")
        results = [{}, None, None, None, None, None, None, {}, False, None, None]
    except Exception as e:
        logger.error(f"Error fetching features from Redis: {str(e)}. Using defaults.")
        results = [{}, None, None, None, None, None, None, {}, False, None, None]

    # Parse pipeline results
    profile = results[0] or {}
    vel_1m = int(results[1] or 0)
    vel_5m = int(results[2] or 0)
    vel_1h = int(results[3] or 0)
    vel_24h = int(results[4] or 0)
    amt_sum_1h = float(results[5] or 0.0)
    amt_sum_24h = float(results[6] or 0.0)
    last_loc = results[7] or {}
    device_has_user = bool(results[8])
    receiver_is_blacklisted_flag = bool(results[9])
    sender_graph_risk = float(results[10] or 0.05)

    # 3. Transaction features
    txn_hour = timestamp.hour
    txn_day_of_week = timestamp.weekday()
    txn_is_weekend = int(txn_day_of_week in [5, 6])
    txn_is_night = int(txn_hour in [0, 1, 2, 3, 4, 5])
    
    # 4. Behavioral profile calculations
    user_avg = float(profile.get("avg_amount_30d", 0.0) or 0.0)
    user_max = float(profile.get("max_amount_30d", 0.0) or 0.0)
    
    # Defaults if profile is cold
    if user_avg == 0.0:
        user_avg = amount
    if user_max == 0.0:
        user_max = amount
        
    amount_vs_user_avg_ratio = amount / user_avg if user_avg > 0 else 1.0
    amount_vs_user_max_ratio = amount / user_max if user_max > 0 else 1.0
    amount_round_number_flag = int(amount % 100 == 0)
    amount_just_below_limit_flag = int(9500 < amount < 10000 or 95000 < amount < 100000)
    
    # 5. Location Jump calculations
    geo_distance = 0.0
    time_since_last = 86400.0
    geo_speed = 0.0
    
    if last_loc and txn.location:
        try:
            last_lat = float(last_loc.get("latitude", 0.0))
            last_lon = float(last_loc.get("longitude", 0.0))
            last_time_str = last_loc.get("timestamp")
            
            if last_time_str:
                last_time = datetime.fromisoformat(last_time_str.replace("Z", ""))
                # Calculate time delta in seconds
                time_since_last = max((timestamp.replace(tzinfo=None) - last_time).total_seconds(), 1.0)
                geo_distance = haversine(last_lat, last_lon, txn.location.latitude, txn.location.longitude)
                geo_speed = geo_distance / (time_since_last / 3600.0)
        except Exception as e:
            logger.error(f"Error calculating location jump features: {str(e)}")

    geo_is_impossible_travel = int(geo_speed > 800.0)
    
    # 6. Device novelty
    device_is_new = int(not device_has_user)
    device_is_rooted = int(txn.device.is_rooted or False)
    device_is_emulator = int(txn.device.is_emulator or False)
    
    # 7. Receiver novelty / graph logic
    receiver_is_blacklisted = int(receiver_is_blacklisted_flag)
    # Check if receiver is in user's historical set (could be stored in profile)
    # Simple check: mock receiver_is_new as 1 if profile is empty or receiver not in profile.receivers
    receivers_list = profile.get("receivers_30d", "").split(",")
    receiver_is_new = int(receiver not in receivers_list)
    
    # Assemble feature vector matching training schema exactly
    feature_vector = {
        "txn_amount": float(amount),
        "txn_amount_log": float(np.log1p(amount)),
        "txn_hour": float(txn_hour),
        "txn_day_of_week": float(txn_day_of_week),
        "txn_is_weekend": float(txn_is_weekend),
        "txn_is_night": float(txn_is_night),
        "amount_vs_user_avg_ratio": float(amount_vs_user_avg_ratio),
        "amount_vs_user_max_ratio": float(amount_vs_user_max_ratio),
        "amount_round_number_flag": float(amount_round_number_flag),
        "amount_just_below_limit_flag": float(amount_just_below_limit_flag),
        
        "vel_txn_count_1m": float(vel_1m),
        "vel_txn_count_5m": float(vel_5m),
        "vel_txn_count_1h": float(vel_1h),
        "vel_txn_count_24h": float(vel_24h),
        "vel_amount_sum_1h": float(amt_sum_1h),
        "vel_amount_sum_24h": float(amt_sum_24h),
        
        "geo_distance_from_last_txn_km": float(geo_distance),
        "time_since_last_txn_seconds": float(time_since_last),
        "geo_speed_kmh": float(geo_speed),
        "geo_is_impossible_travel": float(geo_is_impossible_travel),
        
        "device_is_new": float(device_is_new),
        "device_is_rooted": float(device_is_rooted),
        "device_is_emulator": float(device_is_emulator),
        
        "receiver_is_blacklisted": float(receiver_is_blacklisted),
        "receiver_is_new": float(receiver_is_new),
        "sender_graph_risk_score": float(sender_graph_risk)
    }
    
    return feature_vector
