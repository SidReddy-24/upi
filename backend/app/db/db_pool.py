"""
db_pool.py — Global psycopg3 connection pool for SentinelPay auth/guardian APIs.

Using psycopg_pool.ConnectionPool (sync) to replace per-request psycopg.connect()
which was adding ~80-150ms of connection overhead on every API call.

Pool is initialized once at server startup via init_pool() and closed at shutdown.
"""
import os
import logging
from psycopg_pool import ConnectionPool
from psycopg.rows import dict_row

logger = logging.getLogger("fraudshield.db_pool")

_pool: ConnectionPool | None = None


def _build_conninfo() -> str:
    db_url = os.getenv("DATABASE_URL", "")
    if db_url:
        db_url = db_url.replace("postgresql+psycopg://", "postgresql://", 1)
        return db_url
    host = os.getenv("POSTGRES_HOST", "localhost")
    port = os.getenv("POSTGRES_PORT", "5432")
    dbname = os.getenv("POSTGRES_DB", "fraudshield")
    user = os.getenv("POSTGRES_USER", "fraudshield")
    password = os.getenv("POSTGRES_PASSWORD", "fraudshield_dev")
    return f"host={host} port={port} dbname={dbname} user={user} password={password}"


def init_pool(min_size: int = 2, max_size: int = 10) -> None:
    """Initialize the global connection pool. Call once at server startup."""
    global _pool
    if _pool is not None:
        return
    conninfo = _build_conninfo()
    logger.info(f"[db_pool] Initializing ConnectionPool (min={min_size}, max={max_size})")
    _pool = ConnectionPool(
        conninfo=conninfo,
        min_size=min_size,
        max_size=max_size,
        kwargs={"row_factory": dict_row},
        open=True,
    )
    logger.info("[db_pool] ConnectionPool ready")


def close_pool() -> None:
    """Close the pool at server shutdown."""
    global _pool
    if _pool:
        _pool.close()
        _pool = None
        logger.info("[db_pool] ConnectionPool closed")


def get_conn():
    """
    Context manager — acquire a pooled connection.

    Usage:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(...)
    Falls back to lazy init if startup was skipped (unit tests).
    """
    global _pool
    if _pool is None:
        init_pool()
    return _pool.connection()
