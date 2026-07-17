"""Initialize database by running the schema.sql file."""
import asyncio
import logging
from sqlalchemy import text
from app.db.database import engine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("fraudshield.db_init")

async def init_db():
    logger.info("Initializing database...")
    import os
    schema_path = os.path.join(os.path.dirname(__file__), "schema.sql")
    try:
        with open(schema_path, "r") as f:
            schema_sql = f.read()
        
        async with engine.begin() as conn:
            await conn.execute(text(schema_sql))
            
        logger.info("Database initialized successfully!")
    except Exception as e:
        logger.error(f"Error initializing database: {str(e)}")
        raise

if __name__ == "__main__":
    asyncio.run(init_db())
