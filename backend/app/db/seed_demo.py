"""Demo Seeder script setting up pre-conditions for production-grade demo scenarios."""
import asyncio
import logging
from datetime import datetime, timedelta, timezone
import bcrypt
import psycopg
from psycopg.rows import dict_row
from app.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("fraudshield.seed_demo")

DEMO_USERS = [
    {
        "phone": "+919892150232",
        "email": "demo@sentinelpay.ai",
        "vpa": "demo@sentinelpay",
        "name": "Demo User",
        "balance": 100000.0,
        "upi_pin": "123456"
    },
    {
        "phone": "+919876543210",
        "email": "alice@sentinelpay.ai",
        "vpa": "alice@sentinelpay",
        "name": "Alice Smith",
        "balance": 50000.0,
        "upi_pin": "123456"
    },
    {
        "phone": "+919123456789",
        "email": "bob@sentinelpay.ai",
        "vpa": "bob@sentinelpay",
        "name": "Bob Johnson",
        "balance": 75000.0,
        "upi_pin": "123456"
    },
    {
        "phone": "+919988776655",
        "email": "guardian@sentinelpay.ai",
        "vpa": "guardian@sentinelpay",
        "name": "Trusted Guardian",
        "balance": 120000.0,
        "upi_pin": "123456"
    },
    {
        "phone": "+919111111111",
        "email": "scammer@sentinelpay.ai",
        "vpa": "scammer@sentinelpay",
        "name": "Suspicious Lottery Scam",
        "balance": 500.0,
        "upi_pin": "123456"
    },
    {
        "phone": "+919222222222",
        "email": "phishing_merchant@sentinelpay.ai",
        "vpa": "phishing_merchant@sentinelpay",
        "name": "Fake Bank Support",
        "balance": 0.0,
        "upi_pin": "123456"
    },
    {
        "phone": "+919333333333",
        "email": "starbucks@sentinelpay.ai",
        "vpa": "starbucks@sentinelpay",
        "name": "Starbucks India",
        "balance": 500000.0,
        "upi_pin": "123456"
    },
    {
        "phone": "+919444444444",
        "email": "amazon@sentinelpay.ai",
        "vpa": "amazon@sentinelpay",
        "name": "Amazon Pay Merchant",
        "balance": 1000000.0,
        "upi_pin": "123456"
    }
]

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

async def seed_demo():
    logger.info("Starting demo database and Redis seeding...")
    
    # 1. PostgreSQL Auth Users & Pre-loaded Transactions Seeding
    try:
        from app.api.v1.auth import get_db
        conn = get_db()
        with conn.cursor() as cursor:
            default_pw_hash = hash_password("SentinelPass_1234!")
            
            for u in DEMO_USERS:
                cursor.execute("""
                    INSERT INTO auth_users (phone, email, password_hash, vpa, name, balance, upi_pin)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (phone) DO UPDATE SET
                        vpa = EXCLUDED.vpa,
                        name = EXCLUDED.name,
                        email = EXCLUDED.email
                """, (u["phone"], u["email"], default_pw_hash, u["vpa"], u["name"], u["balance"], u["upi_pin"]))
            
            # Seed historical P2P demo transactions
            sample_txns = [
                ("TXN_SEED_001", "demo@sentinelpay", "starbucks@sentinelpay", 450.0, "APPROVED", "APPROVE", 0.05),
                ("TXN_SEED_002", "demo@sentinelpay", "amazon@sentinelpay", 2499.0, "APPROVED", "APPROVE", 0.08),
                ("TXN_SEED_003", "alice@sentinelpay", "demo@sentinelpay", 1200.0, "APPROVED", "APPROVE", 0.02),
                ("TXN_SEED_004", "bob@sentinelpay", "demo@sentinelpay", 3500.0, "APPROVED", "APPROVE", 0.03),
                ("TXN_SEED_005", "demo@sentinelpay", "scammer@sentinelpay", 15000.0, "REVIEW", "REJECT", 0.88)
            ]

            for t_id, s_vpa, r_vpa, amt, st, dec, risk in sample_txns:
                cursor.execute("""
                    INSERT INTO transactions (transaction_id, sender_vpa, receiver_vpa, amount, currency, txn_type, status, decision, risk_score, created_at)
                    VALUES (%s, %s, %s, %s, 'INR', 'P2P', %s, %s, %s, NOW() - INTERVAL '1 hour')
                    ON CONFLICT (transaction_id) DO NOTHING
                """, (t_id, s_vpa, r_vpa, amt, st, dec, risk))

            conn.commit()
            conn.close()
            logger.info("PostgreSQL auth_users & demo transactions seeded successfully.")
    except Exception as e:
        logger.error(f"PostgreSQL demo seeding failed: {e}")

    # 2. Redis Seeding (Blacklists & Graph Risks)
    try:
        from app.services.redis_service import redis_service
        await redis_service.connect()
        client = await redis_service.get_client()
        if client:
            blacklisted_vpas = [
                "scammer@sentinelpay",
                "phishing_merchant@sentinelpay",
                "mule_account@upi",
                "mule@okhdfc"
            ]
            for vpa in blacklisted_vpas:
                if hasattr(client, 'set'):
                    await client.set(f"vpa:{vpa}:blacklisted", "1")
                    await client.set(f"graph:user:{vpa}:risk", "0.95")
            logger.info("Redis blacklist & risk scores seeded successfully.")
    except Exception as e:
        logger.error(f"Redis demo seeding failed: {e}")

    logger.info("✨ Demo seeding completed successfully.")

if __name__ == "__main__":
    asyncio.run(seed_demo())
