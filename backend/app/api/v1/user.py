"""
SentinelPay AI — User Registration & Cloud Profile API
"""
import uuid
import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from sqlalchemy import text

from app.services.auth_service import verify_api_key

logger = logging.getLogger("fraudshield.user")
router = APIRouter()

# ─── In-Memory Store Fallback for Users & Ledgers ──────────────────────────

USERS_STORE = {
    "demo@sentinelpay": {
        "user_id": "USR_DEMO001",
        "vpa": "demo@sentinelpay",
        "name": "Sentinel Demo User",
        "device_id": "DEV_DEMO_DEFAULT",
        "balance": 100000.0,
        "created_at": "2026-07-21T00:00:00Z"
    },
    "merchant@okaxis": {
        "user_id": "USR_MERCHANT001",
        "vpa": "merchant@okaxis",
        "name": "Axis Retail Merchant",
        "device_id": "DEV_MERCHANT_001",
        "balance": 500000.0,
        "created_at": "2026-07-01T00:00:00Z"
    },
    "mule@okhdfc": {
        "user_id": "USR_MULE001",
        "vpa": "mule@okhdfc",
        "name": "Flagged Mule Account",
        "device_id": "DEV_SUSPICIOUS_99",
        "balance": 1250.0,
        "created_at": "2026-07-15T00:00:00Z"
    }
}

USER_TRANSACTIONS = {}

# ─── Schemas ─────────────────────────────────────────────────────────────────

class UserRegisterRequest(BaseModel):
    device_id: str = Field(..., example="DEV_8A3F91B2")
    name: Optional[str] = Field("Sentinel User", example="Rahul Sharma")
    custom_vpa: Optional[str] = Field(None, example="rahul@sentinelpay")

class UserProfileResponse(BaseModel):
    user_id: str
    vpa: str
    name: str
    device_id: str
    balance: float
    is_active: bool = True

class UserTxnItem(BaseModel):
    id: str
    sender_vpa: str
    receiver_vpa: str
    amount: float
    type: str # DEBIT / CREDIT
    timestamp: str
    status: str
    risk_score: Optional[float] = 0.1

# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.post("/user/register", response_model=UserProfileResponse, dependencies=[Depends(verify_api_key)])
async def register_user(payload: UserRegisterRequest):
    """
    Registers a unique user identity bound to device_id.
    Assigns unique user_id and persistent VPA with ₹1,00,000 SPC balance.
    """
    device_id = payload.device_id.strip()
    
    # Check if user already exists for this device_id
    for u in USERS_STORE.values():
        if u["device_id"] == device_id:
            return UserProfileResponse(**u)

    # Generate unique user_id and VPA
    short_hash = uuid.uuid4().hex[:6].lower()
    user_id = f"USR_{short_hash.upper()}"

    if payload.custom_vpa and "@" in payload.custom_vpa:
        vpa = payload.custom_vpa.strip().lower()
    else:
        clean_name = payload.name.lower().replace(" ", "") if payload.name else "user"
        vpa = f"{clean_name}_{short_hash}@sentinelpay"

    user_data = {
        "user_id": user_id,
        "vpa": vpa,
        "name": payload.name or f"User {short_hash.upper()}",
        "device_id": device_id,
        "balance": 100000.0,
        "created_at": "2026-07-21T03:00:00Z"
    }

    USERS_STORE[vpa] = user_data
    logger.info(f"Registered new unique user: {user_id} | VPA: {vpa} | Device: {device_id}")

    return UserProfileResponse(**user_data)

@router.get("/user/profile/{identifier}", response_model=UserProfileResponse, dependencies=[Depends(verify_api_key)])
async def get_user_profile(identifier: str):
    """
    Fetches user profile & live balance by VPA, user_id, or device_id.
    """
    identifier = identifier.strip()
    
    # Check by VPA
    if identifier in USERS_STORE:
        return UserProfileResponse(**USERS_STORE[identifier])

    # Check by device_id or user_id
    for u in USERS_STORE.values():
        if u["device_id"] == identifier or u["user_id"] == identifier:
            return UserProfileResponse(**u)

    raise HTTPException(status_code=404, detail=f"User identity {identifier} not found.")

@router.get("/user/transactions/{vpa}", response_model=List[UserTxnItem], dependencies=[Depends(verify_api_key)])
async def get_user_transactions(vpa: str):
    """
    Retrieves live transaction ledger for a specific VPA (debits and credits).
    """
    vpa = vpa.strip().lower()
    txns = USER_TRANSACTIONS.get(vpa, [])
    return txns
