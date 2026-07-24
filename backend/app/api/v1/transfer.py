"""
SentinelPay AI — Real Multi-User P2P Settlement Engine
"""
import uuid
import time
import logging
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from app.services.auth_service import verify_api_key
from app.models.transaction import TransactionRequest, DeviceInfo, LocationInfo, NetworkInfo, TransactionMetadata
from app.core.scoring_engine import score_transaction
from datetime import datetime
from app.api.v1.auth import get_db

logger = logging.getLogger("fraudshield.transfer")
router = APIRouter()

# ─── Schemas ─────────────────────────────────────────────────────────────────

class P2PTransferRequest(BaseModel):
    transaction_id: Optional[str] = Field(None, example="TXN_12345678")
    sender_vpa: str = Field(..., example="alice@sentinelpay")
    receiver_vpa: str = Field(..., example="bob@sentinelpay")
    amount: float = Field(..., gt=0, example=2500.0)
    note: Optional[str] = Field("Payment via SentinelPay", example="Dinner split")
    device_id: Optional[str] = Field("DEV_DEFAULT", example="DEV_8A3F91B2")
    ip_address: Optional[str] = Field("103.21.58.200", example="103.21.58.200")
    geo_lat: Optional[float] = Field(12.9716, example=12.9716)
    geo_lon: Optional[float] = Field(77.5946, example=77.5946)
    is_call_active: Optional[bool] = Field(False)
    otp_in_last_60s: Optional[bool] = Field(False)
    sms_fraud_score: Optional[float] = Field(0.0)

class P2PTransferResponse(BaseModel):
    transaction_id: str
    sender_vpa: str
    receiver_vpa: str
    amount: float
    status: str # SUCCESS, REVIEW_REQUIRED, BLOCKED
    decision: str # APPROVE, REVIEW, REJECT
    risk_score: float
    updated_sender_balance: float
    message: str
    explanation_summary: str
    timestamp: str

# ─── Endpoint ────────────────────────────────────────────────────────────────

@router.post("/transfer", response_model=P2PTransferResponse, dependencies=[Depends(verify_api_key)])
async def execute_p2p_transfer(payload: P2PTransferRequest):
    """
    Executes real-time multi-user P2P transfer between VPAs.
    Scores transaction with FraudShield AI, then atomically settles balances in PostgreSQL.
    """
    sender_vpa = payload.sender_vpa.strip().lower()
    receiver_vpa = payload.receiver_vpa.strip().lower()
    
    amount = payload.amount
    txn_id = payload.transaction_id or f"TXN_{uuid.uuid4().hex[:8].upper()}"

    if sender_vpa == receiver_vpa:
        raise HTTPException(status_code=400, detail="Cannot transfer funds to the same VPA account.")

    # 1. Score transaction with FraudShield AI Engine first (non-blocking for DB locks)
    score_payload = TransactionRequest(
        transaction_id=txn_id,
        sender_vpa=sender_vpa,
        receiver_vpa=receiver_vpa,
        amount=amount,
        currency="INR",
        transaction_type="P2P",
        timestamp=datetime.utcnow(),
        device=DeviceInfo(
            device_id=payload.device_id or "DEV_DEFAULT",
            os_type="ANDROID",
            is_emulator=False
        ),
        location=LocationInfo(
            latitude=payload.geo_lat or 12.9716,
            longitude=payload.geo_lon or 77.5946
        ),
        network=NetworkInfo(
            ip_address=payload.ip_address or "127.0.0.1"
        ),
        metadata=TransactionMetadata(
            org_id="SentinelPayApp"
        )
    )

    score_result = await score_transaction(score_payload)
    decision = score_result.decision
    risk_score = score_result.risk_score
    explanation = score_result.explanation.nl_summary if score_result.explanation else "Legitimate transaction"

    if decision == "REJECT":
        raise HTTPException(
            status_code=403,
            detail=f"🚨 TRANSACTION BLOCKED BY AI: {explanation}"
        )

    conn = get_db()
    try:
        # Start short DB transaction block ONLY for atomic balances & ledger insert
        with conn.transaction():
            with conn.cursor() as cursor:
                cursor.execute("SELECT phone, balance FROM auth_users WHERE vpa = %s FOR UPDATE", (sender_vpa,))
                sender_row = cursor.fetchone()
                
                if not sender_row:
                    raise HTTPException(status_code=404, detail=f"Sender VPA {sender_vpa} not found in system.")
                
                sender_phone = sender_row['phone']
                sender_balance = float(sender_row['balance']) if sender_row['balance'] is not None else 100000.0

                if sender_balance < amount:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Insufficient balance. Available: ₹{sender_balance:,.2f} SPC, Required: ₹{amount:,.2f} SPC."
                    )

                cursor.execute("SELECT phone FROM auth_users WHERE vpa = %s FOR UPDATE", (receiver_vpa,))
                receiver_row = cursor.fetchone()
                
                if not receiver_row:
                    raise HTTPException(status_code=404, detail=f"Receiver VPA {receiver_vpa} not found in system.")
                    
                receiver_phone = receiver_row['phone']

                # Atomic Settlement: Deduct sender & Credit receiver
                updated_sender_balance = sender_balance - amount
                cursor.execute("UPDATE auth_users SET balance = %s WHERE phone = %s", (updated_sender_balance, sender_phone))
                cursor.execute("UPDATE auth_users SET balance = COALESCE(balance, 100000.0) + %s WHERE phone = %s", (amount, receiver_phone))

                # Record Transaction in ledger
                status_str = "APPROVED" if decision == "APPROVE" else "REVIEWED"
                cursor.execute("""
                    INSERT INTO transactions (transaction_id, sender_vpa, receiver_vpa, amount, currency, txn_type, status, decision, risk_score)
                    VALUES (%s, %s, %s, %s, 'INR', 'P2P', %s, %s, %s)
                    ON CONFLICT (transaction_id) DO NOTHING
                """, (txn_id, sender_vpa, receiver_vpa, amount, status_str, decision, risk_score))

                logger.info(f"P2P Transfer settled: {sender_phone} → {receiver_phone} | ₹{amount} | Sender Balance: ₹{updated_sender_balance}")
                
                ts_str = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

                return P2PTransferResponse(
                    transaction_id=txn_id,
                    sender_vpa=sender_vpa,
                    receiver_vpa=receiver_vpa,
                    amount=amount,
                    status="SUCCESS" if decision == "APPROVE" else "REVIEW_REQUIRED",
                    decision=decision,
                    risk_score=risk_score,
                    updated_sender_balance=updated_sender_balance,
                    message="Transfer successful" if decision == "APPROVE" else "Transfer under review",
                    explanation_summary=explanation,
                    timestamp=ts_str
                )
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        logger.error(f"Transfer failed: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error during transfer")
    finally:
        conn.close()
