"""Complete Database Cleanup Script for FraudShield & SentinelPay."""
import asyncio
import logging
import psycopg
from app.db.database import async_session_factory
from app.services.redis_service import get_redis
from app.db.init_db import init_db
from app.db.init_auth_db import main as init_auth
from migrations.run_migration import run_migration

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("fraudshield.clean_db")


async def clean_database():
    print("=" * 60)
    print("🧹 FraudShield / SentinelPay Complete Database Cleanup")
    print("=" * 60)

    # 1. Ensure schemas & tables exist
    logger.info("Verifying database schema and migration status...")
    await init_db()
    init_auth()
    await run_migration("002_graph_persistence.sql")
    await run_migration("003_monitoring.sql")

    # 2. Get all tables in public schema and TRUNCATE with CASCADE
    conn_str = "postgresql://fraudshield:fraudshield_dev@localhost:5432/fraudshield"
    with psycopg.connect(conn_str) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'"
            )
            tables = [row[0] for row in cur.fetchall()]
            
            tables_to_truncate = [t for t in tables if t != "schema_migrations"]
            
            if tables_to_truncate:
                truncate_sql = f'TRUNCATE {", ".join(tables_to_truncate)} CASCADE;'
                logger.info(f"Truncating {len(tables_to_truncate)} tables: {tables_to_truncate}")
                cur.execute(truncate_sql)
                conn.commit()
                print("  ✓ PostgreSQL tables truncated successfully.")

            # Re-seed default fraud detection rules R001-R010
            rules_sql = """
            INSERT INTO rules (rule_id, name, condition_dsl, action, severity, explanation, priority)
            VALUES
            ('R001', 'Blacklisted Receiver', '{"AND": [{"feature": "receiver_is_blacklisted", "op": "eq", "value": 1}]}', 'REJECT', 'CRITICAL', 'Recipient VPA is on the fraud blacklist', 10),
            ('R002', 'Extreme Amount', '{"AND": [{"feature": "amount_vs_user_max_ratio", "op": "gt", "value": 3.0}]}', 'FLAG', 'HIGH', 'Transaction amount exceeds 3x user historical maximum', 20),
            ('R003', 'High Velocity', '{"AND": [{"feature": "vel_txn_count_1m", "op": "gt", "value": 5}]}', 'FLAG', 'HIGH', 'More than 5 transactions in the last minute', 30),
            ('R004', 'New Device High Amount', '{"AND": [{"feature": "device_is_new", "op": "eq", "value": 1}, {"feature": "txn_amount", "op": "gt", "value": 10000}]}', 'FLAG', 'MEDIUM', 'High-value transaction from an unrecognized device', 40),
            ('R005', 'Impossible Travel', '{"AND": [{"feature": "geo_distance_from_last_txn_km", "op": "gt", "value": 500}, {"feature": "time_since_last_txn_seconds", "op": "lt", "value": 1800}]}', 'FLAG', 'HIGH', 'Transaction location is physically impossible given prior transaction timing', 50),
            ('R006', 'New Receiver High Amount', '{"AND": [{"feature": "receiver_is_new", "op": "eq", "value": 1}, {"feature": "amount_vs_user_avg_ratio", "op": "gt", "value": 5.0}]}', 'FLAG', 'MEDIUM', 'Large transfer to a first-time recipient', 60),
            ('R007', 'Rooted Device', '{"AND": [{"feature": "device_is_rooted", "op": "eq", "value": 1}, {"feature": "txn_amount", "op": "gt", "value": 5000}]}', 'FLAG', 'MEDIUM', 'Transaction from a rooted/jailbroken device', 70),
            ('R008', 'VPN Detected', '{"AND": [{"feature": "device_vpn_flag", "op": "eq", "value": 1}]}', 'FLAG', 'LOW', 'Transaction routed through a VPN or proxy', 80),
            ('R009', 'Night High Value', '{"AND": [{"feature": "txn_is_night", "op": "eq", "value": 1}, {"feature": "txn_amount", "op": "gt", "value": 20000}]}', 'FLAG', 'MEDIUM', 'High-value transaction during unusual hours (12AM-5AM)', 90),
            ('R010', 'Emulator Detected', '{"AND": [{"feature": "device_is_emulator", "op": "eq", "value": 1}]}', 'FLAG', 'HIGH', 'Transaction originated from a device emulator', 25)
            ON CONFLICT (rule_id) DO NOTHING;
            """
            cur.execute(rules_sql)
            conn.commit()
            print("  ✓ Default rules (R001-R010) re-seeded.")

    # 3. Clean Redis
    try:
        r = await get_redis()
        if r:
            await r.flushdb()
            print("  ✓ Redis cache database flushed successfully.")
            await r.aclose()
    except Exception as e:
        logger.warning(f"Redis cleanup notice: {e}")

    # 4. Clean in-memory store
    try:
        from app.api.v1.user import USERS_STORE
        USERS_STORE.clear()
        print("  ✓ In-memory USERS_STORE cleared.")
    except Exception:
        pass

    print("=" * 60)
    print("✅ Database cleanup completed successfully!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(clean_database())
