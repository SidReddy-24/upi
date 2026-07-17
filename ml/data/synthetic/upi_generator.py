"""Synthetic UPI transaction dataset generator for training and demo seeding."""
import os
import random
import uuid
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

def generate_upi_dataset(num_transactions: int = 20000, output_path: str = "data/raw_transactions.csv"):
    """
    Generate synthetic raw transactions representing normal and fraudulent UPI behavior.
    """
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    print(f"Generating {num_transactions} synthetic transactions...")
    
    # Base lists
    users = [f"user_{i}@upi" for i in range(1, 500)]
    merchants = [f"merchant_{i}@paytm" for i in range(1, 50)]
    mule_receivers = [f"mule_{i}@ybl" for i in range(1, 5)]
    devices = [f"d_{uuid.uuid4().hex[:12]}" for _ in range(300)]
    
    # Assign default devices to users
    user_devices = {u: random.choice(devices) for u in users}
    # Assign home locations to users
    user_homes = {u: (random.uniform(12.8, 13.1), random.uniform(77.4, 77.7)) for u in users} # Bangalore bounding box
    
    # Generate transactions
    data = []
    start_time = datetime.utcnow() - timedelta(days=30)
    
    # Track states for velocity / impossible travel simulation
    last_txn_time = {}
    last_txn_loc = {}
    
    for i in range(num_transactions):
        # Time progression
        time_delta = timedelta(seconds=random.randint(10, 300))
        txn_time = start_time + (time_delta * i / 100) # speed up progression
        
        sender = random.choice(users)
        default_device = user_devices[sender]
        home_lat, home_lon = user_homes[sender]
        
        # Default scenario
        receiver = random.choice(merchants + users)
        amount = round(random.expovariate(1.0 / 1000.0) + 10, 2)
        device_id = default_device
        is_rooted = False
        is_emulator = False
        lat, lon = home_lat + random.uniform(-0.05, 0.05), home_lon + random.uniform(-0.05, 0.05)
        ip_addr = f"{random.randint(49, 223)}.{random.randint(0, 255)}.{random.randint(0, 255)}.{random.randint(1, 254)}"
        is_fraud = 0
        fraud_type = "LEGITIMATE"
        
        # Check if we should inject fraud (~2% probability)
        if random.random() < 0.02:
            is_fraud = 1
            fraud_scenario = random.choice(["velocity", "impossible_travel", "rooted_high_value", "mule_transfer", "new_device_high_value"])
            
            if fraud_scenario == "velocity":
                # High velocity: same user sending several transactions in a short window
                amount = round(random.uniform(5000, 15000), 2)
                is_rooted = random.choice([True, False])
                fraud_type = "HIGH_VELOCITY"
                
            elif fraud_scenario == "impossible_travel":
                # Travel jump (Delhi coordinates)
                lat, lon = 28.6139, 77.2090
                amount = round(random.uniform(8000, 35000), 2)
                fraud_type = "IMPOSSIBLE_TRAVEL"
                
            elif fraud_scenario == "rooted_high_value":
                is_rooted = True
                amount = round(random.uniform(20000, 80000), 2)
                fraud_type = "ROOTED_DEVICE"
                
            elif fraud_scenario == "mule_transfer":
                # Transfer to a known mule account
                receiver = random.choice(mule_receivers)
                amount = round(random.uniform(45000, 95000), 2)
                fraud_type = "MONEY_MULE"
                
            elif fraud_scenario == "new_device_high_value":
                # Brand new device, high value
                device_id = f"d_{uuid.uuid4().hex[:12]}"
                is_rooted = random.choice([True, False])
                is_emulator = random.choice([True, False])
                amount = round(random.uniform(50000, 150000), 2)
                fraud_type = "NEW_DEVICE"
        
        # Enforce amount limits
        if amount > 200000:
            amount = 195000.0
            
        data.append({
            "transaction_id": f"TXN_{txn_time.strftime('%Y%m%d')}_{i:06d}",
            "sender_vpa": sender,
            "receiver_vpa": receiver,
            "amount": amount,
            "currency": "INR",
            "transaction_type": "P2M" if "@merchant" in receiver or "merchant" in receiver else "P2P",
            "timestamp": txn_time.isoformat() + "Z",
            "device_id": device_id,
            "is_rooted": int(is_rooted),
            "is_emulator": int(is_emulator),
            "latitude": lat,
            "longitude": lon,
            "ip_address": ip_addr,
            "org_id": "hdfc_bank" if random.random() < 0.5 else "paytm_psp",
            "is_fraud": is_fraud,
            "fraud_type": fraud_type
        })
        
    df = pd.DataFrame(data)
    df.to_csv(output_path, index=False)
    print(f"Dataset generated at {output_path}. Shape: {df.shape}")

if __name__ == "__main__":
    generate_upi_dataset()
