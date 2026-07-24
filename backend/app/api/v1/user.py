"""
SentinelPay AI — User Registration & Cloud Profile API
"""
import uuid
import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from app.services.auth_service import verify_api_key
from app.api.v1.auth import get_db

logger = logging.getLogger("fraudshield.user")
router = APIRouter()

# ─── Schemas ─────────────────────────────────────────────────────────────────

class UserRegisterRequest(BaseModel):
    phone: str = Field(..., example="9999999999")
    device_id: str = Field(..., example="DEV_8A3F91B2")
    name: Optional[str] = Field("Sentinel User", example="Rahul Sharma")
    custom_vpa: Optional[str] = Field(None, example="rahul@sentinelpay")

class UserProfileResponse(BaseModel):
    user_id: str
    phone: str
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
    decision: Optional[str] = "APPROVE"
    fraud_reason: Optional[str] = None

# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.post("/user/register", response_model=UserProfileResponse, dependencies=[Depends(verify_api_key)])
async def register_user(payload: UserRegisterRequest):
    """
    Registers a unique user identity bound to phone. (Legacy mock endpoint, auth.py handles real registration)
    """
    raise HTTPException(status_code=400, detail="Use /auth/register for full registration flow.")

@router.get("/user/profile/{identifier}", response_model=UserProfileResponse, dependencies=[Depends(verify_api_key)])
async def get_user_profile(identifier: str):
    """
    Fetches user profile & live balance by phone, VPA, email, or id.
    """
    identifier = identifier.strip()
    
    conn = get_db()
    try:
        with conn.cursor() as cursor:
            # Look up by phone, vpa, or email
            cursor.execute("""
                SELECT id::text as user_id, phone, vpa, name, balance, is_active 
                FROM auth_users 
                WHERE phone = %s OR vpa = %s OR email = %s OR id::text = %s
            """, (identifier, identifier, identifier, identifier))
            
            row = cursor.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail=f"User identity {identifier} not found.")
            
            return UserProfileResponse(
                user_id=row['user_id'],
                phone=row['phone'],
                vpa=row['vpa'],
                name=row['name'] or "Sentinel User",
                device_id="DEV_MIGRATED",
                balance=float(row['balance']) if row['balance'] is not None else 100000.0,
                is_active=row['is_active']
            )
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        logger.error(f"Error fetching profile: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")
    finally:
        conn.close()

@router.get("/user/search", dependencies=[Depends(verify_api_key)])
async def search_users(q: str):
    """
    Search registered SentinelPay users by phone, VPA, or name.
    """
    q_str = f"%{q.strip()}%"
    conn = get_db()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT phone, vpa, name, balance, is_active
                FROM auth_users
                WHERE phone ILIKE %s OR vpa ILIKE %s OR name ILIKE %s
                LIMIT 20
            """, (q_str, q_str, q_str))
            rows = cursor.fetchall()
            return [{"phone": r["phone"], "vpa": r["vpa"], "name": r["name"] or "Sentinel User", "balance": float(r["balance"] or 100000.0)} for r in rows]
    except Exception as e:
        logger.error(f"Search users error: {e}")
        return []
    finally:
        conn.close()

@router.get("/user/transactions/{phone}", response_model=List[UserTxnItem], dependencies=[Depends(verify_api_key)])
async def get_user_transactions(phone: str):
    """
    Retrieves live transaction ledger for a specific phone number or VPA (debits and credits).
    """
    phone = phone.strip()
    
    conn = get_db()
    try:
        with conn.cursor() as cursor:
            # First get the VPA for this identifier
            cursor.execute("SELECT vpa FROM auth_users WHERE phone = %s OR vpa = %s", (phone, phone))
            row = cursor.fetchone()
            if not row:
                return []
            vpa = row['vpa']

            cursor.execute("""
                SELECT transaction_id as id, sender_vpa, receiver_vpa, amount, status, decision, risk_score, created_at,
                CASE WHEN sender_vpa = %s THEN 'DEBIT' ELSE 'CREDIT' END as type
                FROM transactions
                WHERE sender_vpa = %s OR receiver_vpa = %s
                ORDER BY created_at DESC
                LIMIT 50
            """, (vpa, vpa, vpa))
            
            rows = cursor.fetchall()
            
            txns = []
            for r in rows:
                txns.append(UserTxnItem(
                    id=r['id'],
                    sender_vpa=r['sender_vpa'],
                    receiver_vpa=r['receiver_vpa'],
                    amount=float(r['amount']),
                    type=r['type'],
                    timestamp=r['created_at'].strftime("%Y-%m-%dT%H:%M:%SZ") if r['created_at'] else "",
                    status=r['status'],
                    risk_score=float(r['risk_score']) if r['risk_score'] is not None else None,
                    decision=r['decision'],
                    fraud_reason=None
                ))
            return txns
    except Exception as e:
        logger.error(f"Error fetching transactions: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")
    finally:
        conn.close()
