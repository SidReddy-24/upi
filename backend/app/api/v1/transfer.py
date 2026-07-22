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
from app.api.v1.user import USERS_STORE, USER_TRANSACTIONS, UserProfileResponse

logger = logging.getLogger("fraudshield.transfer")
router = APIRouter()

# ─── Schemas ─────────────────────────────────────────────────────────────────

class P2PTransferRequest(BaseModel):
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
    Scores transaction with FraudShield AI, then atomically settles balances.
    """
    sender = payload.sender_vpa.strip().lower()
    receiver = payload.receiver_vpa.strip().lower()
    amount = payload.amount

    if sender == receiver:
        raise HTTPException(status_code=400, detail="Cannot transfer funds to the same VPA account.")

    # 1. Ensure sender exists
    if sender not in USERS_STORE:
        USERS_STORE[sender] = {
            "user_id": f"USR_{uuid.uuid4().hex[:6].upper()}",
            "vpa": sender,
            "name": sender.split("@")[0].title(),
            "device_id": payload.device_id or "DEV_UNKNOWN",
            "balance": 100000.0,
            "created_at": "2026-07-21T03:00:00Z"
        }

    sender_account = USERS_STORE[sender]

    # 2. Check sufficient balance
    if sender_account["balance"] < amount:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient balance. Available: ₹{sender_account['balance']:,.2f} SPC, Required: ₹{amount:,.2f} SPC."
        )

    # 3. Score transaction with FraudShield AI Engine
    score_payload = TransactionRequest(
        transaction_id=f"TXN_{uuid.uuid4().hex[:8].upper()}",
        sender_vpa=sender,
        receiver_vpa=receiver,
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

    # 4. Atomic Settlement: Deduct sender & Credit receiver
    sender_account["balance"] -= amount

    # Ensure receiver account exists
    if receiver not in USERS_STORE:
        USERS_STORE[receiver] = {
            "user_id": f"USR_{uuid.uuid4().hex[:6].upper()}",
            "vpa": receiver,
            "name": receiver.split("@")[0].title(),
            "device_id": f"DEV_REC_{uuid.uuid4().hex[:4]}",
            "balance": 100000.0 + amount,
            "created_at": "2026-07-21T03:00:00Z"
        }
    else:
        USERS_STORE[receiver]["balance"] += amount

    # 5. Record Transaction in User Ledgers
    txn_id = f"TXN_{uuid.uuid4().hex[:8].upper()}"
    ts_str = time.strftime("%Y-%m-%d %H:%M:%S")

    # Debit record for sender
    debit_item = {
        "id": txn_id,
        "sender_vpa": sender,
        "receiver_vpa": receiver,
        "amount": amount,
        "type": "DEBIT",
        "timestamp": ts_str,
        "status": "APPROVED" if decision == "APPROVE" else "REVIEWED",
        "risk_score": risk_score
    }

    # Credit record for receiver
    credit_item = {
        "id": txn_id,
        "sender_vpa": sender,
        "receiver_vpa": receiver,
        "amount": amount,
        "type": "CREDIT",
        "timestamp": ts_str,
        "status": "APPROVED",
        "risk_score": risk_score
    }

    if sender not in USER_TRANSACTIONS:
        USER_TRANSACTIONS[sender] = []
    USER_TRANSACTIONS[sender].insert(0, debit_item)

    if receiver not in USER_TRANSACTIONS:
        USER_TRANSACTIONS[receiver] = []
    USER_TRANSACTIONS[receiver].insert(0, credit_item)

    logger.info(f"P2P Transfer settled: {sender} → {receiver} | ₹{amount} | Sender Balance: ₹{sender_account['balance']}")

    return P2PTransferResponse(
        transaction_id=txn_id,
        sender_vpa=sender,
        receiver_vpa=receiver,
        amount=amount,
        status="SUCCESS",
        decision=decision,
        risk_score=risk_score,
        updated_sender_balance=sender_account["balance"],
        message=f"₹{amount:,.2f} transferred successfully to {receiver}.",
        explanation_summary=explanation,
        timestamp=ts_str
    )
