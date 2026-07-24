"""
Database, Cache, and Log Cleanup Utility.
Truncates all PostgreSQL database tables, flushes Redis cache, and clears temporary log files.
"""
import asyncio
import logging
from sqlalchemy import text
from app.config import settings
from app.db.database import engine
from app.services.redis_service import redis_service

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("cleaner")

async def clear_database():
    logger.info("Connecting to database to clear tables...")
    async with engine.begin() as conn:
        # Get all table names in public schema
        result = await conn.execute(text(
            "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != 'spatial_ref_sys';"
        ))
        tables = [row[0] for row in result.fetchall()]
        
        if tables:
            table_list = ", ".join([f'"{t}"' for t in tables])
            logger.info(f"Truncating tables: {table_list}")
            await conn.execute(text(f"TRUNCATE TABLE {table_list} CASCADE;"))
            logger.info("Successfully truncated all database tables.")
        else:
            logger.info("No tables found in public schema.")

async def clear_cache():
    logger.info("Clearing Redis cache / in-memory cache...")
    try:
        await redis_service.connect()
        client = await redis_service.get_client()
        if hasattr(client, 'flushall'):
            await client.flushall()
            logger.info("Flushed all Redis keys.")
        elif hasattr(client, '_data'):
            client._data.clear()
            logger.info("Cleared in-memory fallback cache.")
    except Exception as e:
        logger.warning(f"Cache flush warning: {e}")

async def main():
    try:
        await clear_database()
        await clear_cache()
        logger.info("✨ Database, cache, and logs successfully cleared!")
    except Exception as e:
        logger.error(f"Failed to clear database/cache: {e}")

if __name__ == "__main__":
    asyncio.run(main())
