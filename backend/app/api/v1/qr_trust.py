"""
QR Trust API — Phase 6.3
GET /api/v1/qr/trust/{vpa}

Returns a trust score and status flags for a given VPA (Virtual Payment Address).
Used by the SentinelPay mobile app before payment confirmation to show a trust badge.

Trust levels:
  VERIFIED  → risk_score < 0.20 and not blacklisted
  CAUTION   → risk_score 0.20–0.60
  FLAGGED   → risk_score > 0.60 or explicitly blacklisted
"""
import logging
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional, List
from app.services.redis_service import get_redis
from app.engines.graph_engine import graph_engine
from app.services.auth_service import verify_api_key

logger = logging.getLogger("fraudshield.api.qr_trust")
router = APIRouter()


class QRTrustResponse(BaseModel):
    vpa: str
    trust_level: str           # VERIFIED | CAUTION | FLAGGED
    trust_score: float         # 0.0 (clean) → 1.0 (high risk)
    is_blacklisted: bool
    flags: List[str]
    message: str
    checked_sources: List[str]


@router.get("/qr/trust/{vpa}", response_model=QRTrustResponse)
async def get_qr_trust(
    vpa: str,
    api_key: str = Depends(verify_api_key),
):
    """
    Returns trust status for a VPA.
    Checks: Redis blacklist, graph engine risk, transaction history risk signals.
    """
    flags: List[str] = []
    checked_sources: List[str] = []
    trust_score = 0.0

    # ── 1. Redis blacklist check ──────────────────────────────────────────────
    try:
        redis = await get_redis()
        blacklisted = await redis.get(f"vpa:{vpa}:blacklisted")
        checked_sources.append("redis_blacklist")
        if blacklisted:
            flags.append("BLACKLISTED_VPA")
            trust_score = max(trust_score, 0.95)
    except Exception as e:
        logger.warning(f"Redis blacklist check failed for {vpa}: {e}")

    # ── 2. Redis graph risk check ─────────────────────────────────────────────
    try:
        graph_risk_raw = await redis.get(f"graph:user:{vpa}:risk")
        checked_sources.append("redis_graph_risk")
        if graph_risk_raw:
            gr = float(graph_risk_raw)
            trust_score = max(trust_score, gr)
            if gr > 0.6:
                flags.append("HIGH_GRAPH_RISK")
    except Exception as e:
        logger.warning(f"Graph risk Redis check failed for {vpa}: {e}")

    # ── 3. In-memory graph engine check ──────────────────────────────────────
    try:
        graph_result = graph_engine.check_node_risk(vpa, vpa, "")
        checked_sources.append("graph_engine")
        engine_risk = graph_result.get("graph_risk_score", 0.0)
        trust_score = max(trust_score, engine_risk)
        if graph_result.get("fraud_ring_flag"):
            flags.append("FRAUD_RING_MEMBER")
        if graph_result.get("hops_to_fraud", -1) == 1:
            flags.append("DIRECT_FRAUD_CONNECTION")
        elif 2 <= graph_result.get("hops_to_fraud", -1) <= 3:
            flags.append("NEAR_FRAUD_CONNECTION")
    except Exception as e:
        logger.warning(f"Graph engine check failed for {vpa}: {e}")

    # ── Determine trust level ─────────────────────────────────────────────────
    is_blacklisted = "BLACKLISTED_VPA" in flags

    if is_blacklisted or trust_score >= 0.60:
        trust_level = "FLAGGED"
        message = "⚠️ This VPA has been flagged for suspicious activity. Do not proceed."
    elif trust_score >= 0.20:
        trust_level = "CAUTION"
        message = "⚠️ Exercise caution. This VPA has some risk signals."
    else:
        trust_level = "VERIFIED"
        message = "✓ This VPA appears clean based on available signals."

    return QRTrustResponse(
        vpa=vpa,
        trust_level=trust_level,
        trust_score=round(trust_score, 4),
        is_blacklisted=is_blacklisted,
        flags=flags,
        message=message,
        checked_sources=checked_sources,
    )
