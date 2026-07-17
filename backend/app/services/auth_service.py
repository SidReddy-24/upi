"""API Key Authentication and Rate Limiting Service."""
import time
import logging
from fastapi import Header, HTTPException, Security, status
from app.config import settings
from app.services.redis_service import get_redis

logger = logging.getLogger("fraudshield.auth")

async def verify_api_key(
    x_api_key: str = Header(..., alias="X-API-Key", description="API Key for accessing FraudShield")
) -> str:
    """Dependency validating API keys against configured options."""
    if x_api_key not in settings.api_key_list:
        logger.warning(f"Unauthorized access attempt with API key: {x_api_key[:6]}...")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired API Key"
        )
        
    # Rate Limiting Check (Redis token bucket simulation or basic incr count)
    try:
        redis = await get_redis()
        rate_limit_key = f"rate_limit:{x_api_key}:{int(time.time()) // 60}"
        request_count = await redis.incr(rate_limit_key)
        
        # Expire rate limit bucket key after 2 minutes
        await redis.set(rate_limit_key, str(request_count), ex=120)
        
        if request_count > settings.RATE_LIMIT_PER_MINUTE:
            logger.warning(f"Rate limit exceeded for API key: {x_api_key[:6]}")
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded. Standard tier limit: 10,000 req/min"
            )
    except HTTPException:
        raise
    except Exception as e:
        # Fail-open for rate limiting to protect latency SLA
        logger.error(f"Rate limiter connection error: {str(e)}. Permitting request.")
        
    return x_api_key
