"""Feature engineering for ML training dataset."""
import pandas as pd
import numpy as np
from datetime import datetime
import os

def compute_haversine(lat1, lon1, lat2, lon2):
    """Compute distance in km using Haversine formula."""
    if pd.isna(lat1) or pd.isna(lon1) or pd.isna(lat2) or pd.isna(lon2):
        return 0.0
    R = 6371.0  # Earth radius in km
    dlat = np.radians(lat2 - lat1)
    dlon = np.radians(lon2 - lon1)
    a = np.sin(dlat/2)**2 + np.cos(np.radians(lat1)) * np.cos(np.radians(lat2)) * np.sin(dlon/2)**2
    c = 2 * np.arcsin(np.sqrt(a))
    return R * c

def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Simulate historical sequence and build feature vector for each transaction.
    """
    df = df.copy()
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df = df.sort_values('timestamp').reset_index(drop=True)
    
    # Feature container
    features = []
    
    # Track historical user state to simulate real-time aggregates
    user_txns = {}
    mule_accounts = set(df[df['fraud_type'] == 'MONEY_MULE']['receiver_vpa'].unique())
    
    print("Engineering features for training dataset (simulating timeline)...")
    
    for idx, row in df.iterrows():
        user = row['sender_vpa']
        amount = row['amount']
        time = row['timestamp']
        lat = row['latitude']
        lon = row['longitude']
        device = row['device_id']
        is_rooted = row['is_rooted']
        is_emulator = row['is_emulator']
        receiver = row['receiver_vpa']
        
        # Initialize user state if first time
        if user not in user_txns:
            user_txns[user] = {
                'amounts': [],
                'timestamps': [],
                'locations': [],
                'devices': set(),
                'receivers': set(),
            }
            
        history = user_txns[user]
        
        # User aggregates
        amounts_hist = history['amounts']
        times_hist = history['timestamps']
        locs_hist = history['locations']
        devices_hist = history['devices']
        receivers_hist = history['receivers']
        
        # Transaction Features
        txn_hour = time.hour
        txn_day_of_week = time.weekday()
        txn_is_weekend = int(txn_day_of_week in [5, 6])
        txn_is_night = int(txn_hour in [0, 1, 2, 3, 4, 5])
        
        # User Profile Defaults / Aggregates
        user_avg = np.mean(amounts_hist) if amounts_hist else amount
        user_std = np.std(amounts_hist) if len(amounts_hist) > 1 else 0.0
        user_max = np.max(amounts_hist) if amounts_hist else amount
        user_median = np.median(amounts_hist) if amounts_hist else amount
        
        amount_vs_user_avg_ratio = amount / user_avg if user_avg > 0 else 1.0
        amount_vs_user_max_ratio = amount / user_max if user_max > 0 else 1.0
        amount_round_number_flag = int(amount % 100 == 0)
        amount_just_below_limit_flag = int(9500 < amount < 10000 or 95000 < amount < 100000)
        
        # Velocity Features (rolling time windows)
        t_1m = time - pd.Timedelta(minutes=1)
        t_5m = time - pd.Timedelta(minutes=5)
        t_1h = time - pd.Timedelta(hours=1)
        t_24h = time - pd.Timedelta(hours=24)
        
        vel_txn_count_1m = sum(1 for t in times_hist if t >= t_1m)
        vel_txn_count_5m = sum(1 for t in times_hist if t >= t_5m)
        vel_txn_count_1h = sum(1 for t in times_hist if t >= t_1h)
        vel_txn_count_24h = sum(1 for t in times_hist if t >= t_24h)
        
        vel_amount_sum_1h = sum(a for a, t in zip(amounts_hist, times_hist) if t >= t_1h)
        vel_amount_sum_24h = sum(a for a, t in zip(amounts_hist, times_hist) if t >= t_24h)
        
        # Location Features
        if locs_hist:
            last_lat, last_lon = locs_hist[-1]
            geo_distance_from_last_txn_km = compute_haversine(last_lat, last_lon, lat, lon)
            last_time = times_hist[-1]
            time_since_last_txn_seconds = max((time - last_time).total_seconds(), 1.0)
            geo_speed_kmh = (geo_distance_from_last_txn_km / (time_since_last_txn_seconds / 3600.0))
        else:
            geo_distance_from_last_txn_km = 0.0
            time_since_last_txn_seconds = 86400.0  # default large
            geo_speed_kmh = 0.0
            
        geo_is_impossible_travel = int(geo_speed_kmh > 800.0)
        
        # Device Features
        device_is_new = int(device not in devices_hist)
        
        # Graph Features (simplified representation for LightGBM input)
        receiver_is_blacklisted = int(receiver in mule_accounts)
        receiver_is_new = int(receiver not in receivers_hist)
        sender_graph_risk_score = 0.9 if receiver in mule_accounts else 0.05
        
        # Build features row dict
        features.append({
            "txn_amount": amount,
            "txn_amount_log": np.log1p(amount),
            "txn_hour": txn_hour,
            "txn_day_of_week": txn_day_of_week,
            "txn_is_weekend": txn_is_weekend,
            "txn_is_night": txn_is_night,
            "amount_vs_user_avg_ratio": amount_vs_user_avg_ratio,
            "amount_vs_user_max_ratio": amount_vs_user_max_ratio,
            "amount_round_number_flag": amount_round_number_flag,
            "amount_just_below_limit_flag": amount_just_below_limit_flag,
            
            "vel_txn_count_1m": vel_txn_count_1m,
            "vel_txn_count_5m": vel_txn_count_5m,
            "vel_txn_count_1h": vel_txn_count_1h,
            "vel_txn_count_24h": vel_txn_count_24h,
            "vel_amount_sum_1h": vel_amount_sum_1h,
            "vel_amount_sum_24h": vel_amount_sum_24h,
            
            "geo_distance_from_last_txn_km": geo_distance_from_last_txn_km,
            "time_since_last_txn_seconds": time_since_last_txn_seconds,
            "geo_speed_kmh": geo_speed_kmh,
            "geo_is_impossible_travel": geo_is_impossible_travel,
            
            "device_is_new": device_is_new,
            "device_is_rooted": int(is_rooted),
            "device_is_emulator": int(is_emulator),
            
            "receiver_is_blacklisted": receiver_is_blacklisted,
            "receiver_is_new": receiver_is_new,
            "sender_graph_risk_score": sender_graph_risk_score,
            
            "is_fraud": row['is_fraud']
        })
        
        # Update user historical state
        history['amounts'].append(amount)
        history['timestamps'].append(time)
        history['locations'].append((lat, lon))
        history['devices'].add(device)
        history['receivers'].add(receiver)
        
    return pd.DataFrame(features)

if __name__ == "__main__":
    df = pd.read_csv("data/raw_transactions.csv")
    feat_df = engineer_features(df)
    feat_df.to_csv("data/processed_features.csv", index=False)
    print("Features engineered and saved.")
