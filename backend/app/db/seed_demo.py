"""Demo Seeder script setting up pre-conditions for the 4 judge demo scenarios."""
import asyncio
import logging
from datetime import datetime, timedelta
from sqlalchemy import text

from app.db.database import engine, async_session_factory
from app.services.redis_service import get_redis

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("fraudshield.seed_demo")

async def seed_demo():
    logger.info("Starting demo seeding...")
    
    # 1. PostgreSQL Seeding
    try:
        async with async_session_factory() as session:
            # Clean existing records
            logger.info("Cleaning old database records...")
            await session.execute(text("TRUNCATE feedback, risk_scores, fraud_cases, transactions, users, devices CASCADE"))
            
            # Seed Users
            logger.info("Inserting demo users...")
            users_data = [
                # Normal user Rahul Sharma
                {
                    "user_id": "u_rahul_sharma",
                    "vpa": "rahul.sharma@upi",
                    "phone_hash": "sha256_rahul_phone",
                    "home_lat": 12.9716,
                    "home_lon": 77.5946,
                    "risk_level": "NORMAL",
                    "total_txns": 45
                },
                # Normal user Amit Patel
                {
                    "user_id": "u_amit_patel",
                    "vpa": "amit.patel@upi",
                    "phone_hash": "sha256_amit_phone",
                    "home_lat": 19.0760,
                    "home_lon": 72.8777,
                    "risk_level": "NORMAL",
                    "total_txns": 12
                },
                # Flagged fraud user (Scenario 3 helper)
                {
                    "user_id": "u_fraud_mule",
                    "vpa": "mule_account@upi",
                    "phone_hash": "sha256_mule_phone",
                    "home_lat": 28.6139,
                    "home_lon": 77.2090,
                    "risk_level": "HIGH",
                    "total_txns": 82
                }
            ]
            
            for u in users_data:
                await session.execute(
                    text("""
                        INSERT INTO users (user_id, vpa, phone_hash, account_created_at, home_lat, home_lon, risk_level, total_txns)
                        VALUES (:user_id, :vpa, :phone_hash, NOW() - INTERVAL '30 days', :home_lat, :home_lon, :risk_level, :total_txns)
                    """),
                    u
                )
                
            # Seed Devices
            logger.info("Inserting demo devices...")
            devices_data = [
                {
                    "device_id": "trusted_device_001",
                    "fp_hash": "fp_rahul_trusted_hash",
                    "os_type": "ANDROID",
                    "os_version": "14",
                    "app_version": "5.2.1",
                    "is_rooted": False,
                    "is_emulator": False,
                    "risk_score": 0.02
                },
                {
                    "device_id": "rooted_attacker_device",
                    "fp_hash": "fp_attacker_rooted_hash",
                    "os_type": "ANDROID",
                    "os_version": "13",
                    "app_version": "5.2.0",
                    "is_rooted": True,
                    "is_emulator": False,
                    "risk_score": 0.65
                }
            ]
            
            for d in devices_data:
                await session.execute(
                    text("""
                        INSERT INTO devices (device_id, fp_hash, os_type, os_version, app_version, is_rooted, is_emulator, risk_score)
                        VALUES (:device_id, :fp_hash, :os_type, :os_version, :app_version, :is_rooted, :is_emulator, :risk_score)
                    """),
                    d
                )
                
            # Seed 15 historical transactions to mule VPA to represent Fraud Ring (Scenario 3)
            logger.info("Inserting 15 historical fraud ring helper transactions...")
            for i in range(1, 16):
                await session.execute(
                    text("""
                        INSERT INTO transactions (
                            transaction_id, sender_vpa, receiver_vpa, amount, currency, 
                            txn_type, device_id, ip_address, geo_lat, geo_lon, 
                            risk_score, confidence, decision, created_at, scored_at, status
                        ) VALUES (
                            :txn_id, :sender, 'mule_account@upi', :amount, 'INR',
                            'P2P', 'mule_device_id', '103.22.12.1', 28.6139, 77.2090,
                            0.82, 0.90, 'REVIEW', NOW() - (:h_ago * INTERVAL '1 HOUR'), NOW() - (:h_ago * INTERVAL '1 HOUR'), 'SCORED'
                        )
                    """),
                    {
                        "txn_id": f"TXN_RING_{i:03d}",
                        "sender": f"ring_sender_{i}@upi",
                        "amount": 5000 + i * 500,
                        "h_ago": 24 - i
                    }
                )
                
            await session.commit()
            logger.info("PostgreSQL seeding completed.")
    except Exception as e:
        logger.error(f"PostgreSQL seeding failed: {str(e)}")

    # 2. Redis Seeding (Profiles, Velocity counters)
    try:
        redis = await get_redis()
        logger.info("Seeding Redis feature stores...")
        
        # User Profile for Rahul Sharma
        profile_key = "user:rahul.sharma@upi:profile"
        await redis.hset(profile_key, mapping={
            "avg_amount_30d": "2150.50",
            "std_amount_30d": "890.20",
            "max_amount_30d": "15000.00",
            "median_amount_30d": "1800.00",
            "avg_txn_per_day_30d": "2.3",
            "avg_txn_hour_30d": "14.5",
            "std_txn_hour_30d": "3.2",
            "home_lat": "12.9716",
            "home_lon": "77.5946",
            "home_radius_km": "15.0",
            "receivers_30d": "grocerystore@paytm,mom@upi,landlord@ybl"
        })
        
        # Last location for Rahul Sharma (20 minutes ago, in Bangalore)
        last_loc_key = "user:rahul.sharma@upi:last_loc"
        last_time = (datetime.utcnow() - timedelta(minutes=20)).isoformat() + "Z"
        await redis.hset(last_loc_key, mapping={
            "latitude": "12.9716",
            "longitude": "77.5946",
            "timestamp": last_time
        })
        
        # Pre-seed Device Trusted Set for Rahul Sharma
        await redis.sadd("device:trusted_device_001:users", "rahul.sharma@upi")
        
        # Graph Risk Score pre-seeding
        await redis.set("graph:user:rahul.sharma@upi:risk", "0.02")
        await redis.set("graph:user:mule_account@upi:risk", "0.85")
        
        # Blacklist receiver VPA
        await redis.set("vpa:mule_account@upi:blacklisted", "1")
        
        logger.info("Redis seeding completed.")
    except Exception as e:
        logger.error(f"Redis seeding failed: {str(e)}")

    logger.info("Demo seeding completed successfully.")

if __name__ == "__main__":
    asyncio.run(seed_demo())
