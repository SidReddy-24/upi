"""Async Redis Service with in-memory fallback for high availability."""
import logging
from typing import Optional

import redis.asyncio as aioredis
from app.config import settings

logger = logging.getLogger("fraudshield.redis")

class InMemoryFallbackRedis:
    """Mock Redis in-memory storage to fall back on if Redis connection fails."""
    def __init__(self):
        self._data = {}
        logger.warning("Initializing InMemoryFallbackRedis. Data will not persist across restarts.")

    async def get(self, key: str) -> Optional[str]:
        return self._data.get(key)

    async def set(self, key: str, value: str, ex: Optional[int] = None) -> bool:
        self._data[key] = value
        # Simple expiration simulation is not needed for short demo runs
        return True

    async def hgetall(self, name: str) -> dict[str, str]:
        res = {}
        for k, v in self._data.items():
            if k.startswith(f"{name}:"):
                field = k.split(":", 1)[1]
                res[field] = v
        return res

    async def hset(self, name: str, key: Optional[str] = None, value: Optional[str] = None, mapping: Optional[dict] = None) -> int:
        if mapping:
            for k, v in mapping.items():
                self._data[f"{name}:{k}"] = str(v)
            return len(mapping)
        if key and value is not None:
            self._data[f"{name}:{key}"] = str(value)
            return 1
        return 0

    async def hmget(self, name: str, keys: list[str]) -> list[Optional[str]]:
        return [self._data.get(f"{name}:{k}") for k in keys]

    async def incr(self, key: str) -> int:
        val = int(self._data.get(key, 0)) + 1
        self._data[key] = str(val)
        return val

    async def incrbyfloat(self, key: str, amount: float) -> float:
        val = float(self._data.get(key, 0.0)) + amount
        self._data[key] = str(val)
        return val

    async def pfadd(self, name: str, *values) -> int:
        # Simulate HyperLogLog by adding to a set
        set_key = f"hll:{name}"
        if set_key not in self._data:
            self._data[set_key] = set()
        count = 0
        for val in values:
            if val not in self._data[set_key]:
                self._data[set_key].add(val)
                count += 1
        return count

    async def pfcount(self, name: str) -> int:
        set_key = f"hll:{name}"
        return len(self._data.get(set_key, set()))

    async def sadd(self, name: str, *values) -> int:
        set_key = f"set:{name}"
        if set_key not in self._data:
            self._data[set_key] = set()
        count = 0
        for val in values:
            if val not in self._data[set_key]:
                self._data[set_key].add(str(val))
                count += 1
        return count

    async def scard(self, name: str) -> int:
        set_key = f"set:{name}"
        return len(self._data.get(set_key, set()))

    async def sismember(self, name: str, value: str) -> bool:
        set_key = f"set:{name}"
        return str(value) in self._data.get(set_key, set())

    async def mget(self, keys: list[str]) -> list[Optional[str]]:
        return [self._data.get(k) for k in keys]

    async def pipeline(self):
        return InMemoryPipeline(self)

    async def ping(self) -> bool:
        return True


class InMemoryPipeline:
    """Mock Redis Pipeline."""
    def __init__(self, db):
        self.db = db
        self.commands = []

    def get(self, key: str):
        self.commands.append(("get", [key]))
        return self

    def mget(self, keys: list[str]):
        self.commands.append(("mget", [keys]))
        return self

    def hgetall(self, name: str):
        self.commands.append(("hgetall", [name]))
        return self

    def hmget(self, name: str, keys: list[str]):
        self.commands.append(("hmget", [name, keys]))
        return self

    def sismember(self, name: str, value: str):
        self.commands.append(("sismember", [name, value]))
        return self

    def scard(self, name: str):
        self.commands.append(("scard", [name]))
        return self

    def pfcount(self, name: str):
        self.commands.append(("pfcount", [name]))
        return self

    async def execute(self):
        results = []
        for cmd, args in self.commands:
            method = getattr(self.db, cmd)
            results.append(await method(*args))
        return results


class RedisService:
    """Redis Service Manager with Asyncio support."""
    def __init__(self):
        self.client = None
        self.is_fallback = False

    async def connect(self):
        try:
            logger.info(f"Connecting to Redis at {settings.REDIS_URL}...")
            self.client = aioredis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                max_connections=settings.REDIS_MAX_CONNECTIONS
            )
            # Ping to verify connection
            await self.client.ping()
            logger.info("Connected to Redis successfully.")
            self.is_fallback = False
        except Exception as e:
            logger.error(f"Redis connection failed: {str(e)}. Falling back to in-memory storage.")
            self.client = InMemoryFallbackRedis()
            self.is_fallback = True

    async def get_client(self):
        if not self.client:
            await self.connect()
        return self.client


redis_service = RedisService()

async def get_redis():
    """Dependency to get Redis client."""
    return await redis_service.get_client()
