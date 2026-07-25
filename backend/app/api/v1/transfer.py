"""
SentinelPay AI — Real Multi-User P2P Settlement Engine
"""
import uuid
import time
import json
import logging
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from app.services.auth_service import verify_api_key
from app.models.transaction import TransactionRequest, DeviceInfo, LocationInfo, NetworkInfo, TransactionMetadata
from app.core.scoring_engine import score_transaction
from datetime import datetime, timedelta, timezone
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

import secrets
import string

def generate_transaction_id() -> str:
    """Generate realistic financial reference ID, e.g., SP250726X91M84."""
    date_str = datetime.utcnow().strftime("%d%m%y")
    rand_part = ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(6))
    return f"SP{date_str}{rand_part}"


@router.post("/transfer", response_model=P2PTransferResponse, dependencies=[Depends(verify_api_key)])
async def execute_p2p_transfer(payload: P2PTransferRequest):
    """
    Executes real-time multi-user P2P transfer between VPAs.
    Scores transaction with FraudShield AI, then atomically settles balances in PostgreSQL.
    """
    sender_vpa = payload.sender_vpa.strip().lower()
    receiver_vpa = payload.receiver_vpa.strip().lower()
    
    amount = payload.amount
    txn_id = payload.transaction_id or generate_transaction_id()

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
        with conn.cursor() as cursor:
            cursor.execute("SELECT id, phone, name, balance FROM auth_users WHERE vpa = %s", (sender_vpa,))
            sender_row = cursor.fetchone()
            
            if not sender_row:
                raise HTTPException(status_code=404, detail=f"Sender VPA {sender_vpa} not found in system.")
            
            sender_phone = sender_row['phone']
            sender_name = sender_row.get('name') or sender_vpa
            sender_balance = float(sender_row['balance']) if sender_row['balance'] is not None else 100000.0

            if sender_balance < amount:
                raise HTTPException(
                    status_code=400,
                    detail=f"Insufficient balance. Available: ₹{sender_balance:,.2f} SPC, Required: ₹{amount:,.2f} SPC."
                )

            cursor.execute("SELECT id, phone, name FROM auth_users WHERE vpa = %s", (receiver_vpa,))
            receiver_row = cursor.fetchone()
            
            if not receiver_row:
                raise HTTPException(status_code=404, detail=f"Receiver VPA {receiver_vpa} not found in system.")
                
            receiver_phone = receiver_row['phone']
            receiver_id = str(receiver_row.get('id') or receiver_phone)

            # ─── Server-Side Guardian Enforcement Check ───────────────────────
            sender_id = str(sender_row['id'])
            cursor.execute("""
                SELECT COUNT(*) as count FROM guardian_relationships
                WHERE user_id = %s AND status = 'ACTIVE'
            """, (sender_id,))
            guard_count_row = cursor.fetchone()
            has_active_guardians = (guard_count_row['count'] if guard_count_row else 0) > 0

            if has_active_guardians:
                from app.api.v1.guardian import _get_ward_config, _increment_cumulative_spent, manager
                cfg = _get_ward_config(cursor, sender_id)
                spending_limit = cfg['spending_limit']
                cumulative_spent = cfg['cumulative_spent']
                timeout_mins = cfg['timeout_minutes']

                if (cumulative_spent + amount) > spending_limit:
                    # Hard-stop: transaction exceeds cumulative spending limit
                    expires_at = datetime.now(timezone.utc) + timedelta(minutes=timeout_mins)
                    
                    # Fetch active guardians
                    cursor.execute("""
                        SELECT id, guardian_user_id FROM guardian_relationships
                        WHERE user_id = %s AND status = 'ACTIVE'
                    """, (sender_id,))
                    active_guardians = cursor.fetchall()

                    # Record transaction as GUARDIAN_HOLD in ledger
                    cursor.execute("""
                        INSERT INTO transactions (transaction_id, sender_vpa, receiver_vpa, amount, currency, txn_type, status, decision, risk_score)
                        VALUES (%s, %s, %s, %s, 'INR', 'P2P', 'GUARDIAN_HOLD', 'REVIEW', %s)
                        ON CONFLICT (transaction_id) DO UPDATE SET status = 'GUARDIAN_HOLD', decision = 'REVIEW'
                    """, (txn_id, sender_vpa, receiver_vpa, amount, risk_score))

                    req_ids = []
                    for g in active_guardians:
                        req_signals = ["CUMULATIVE_LIMIT_EXCEEDED"]
                        if score_result.explanation:
                            if hasattr(score_result.explanation, "top_features") and score_result.explanation.top_features:
                                req_signals.extend([str(f) for f in score_result.explanation.top_features])
                            elif hasattr(score_result.explanation, "reasons") and score_result.explanation.reasons:
                                req_signals.extend([str(r) for r in score_result.explanation.reasons])

                        cursor.execute("""
                            INSERT INTO guardian_approval_requests (transaction_id, user_id, guardian_id, amount, recipient_vpa, fraud_score, risk_signals, expires_at)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                            RETURNING id
                        """, (
                            txn_id,
                            sender_id,
                            g['id'],
                            amount,
                            receiver_vpa,
                            risk_score,
                            json.dumps(req_signals),
                            expires_at
                        ))
                        req_row = cursor.fetchone()
                        req_id = str(req_row['id'])
                        req_ids.append(req_id)

                        # Send WebSocket notification to guardian
                        try:
                            import asyncio
                            asyncio.create_task(manager.send_personal_message({
                                "type": "APPROVAL_REQUEST",
                                "data": {
                                    "request_id": req_id,
                                    "transaction_id": txn_id,
                                    "amount": amount,
                                    "recipient_vpa": receiver_vpa,
                                    "fraud_score": risk_score,
                                    "risk_signals": req_signals,
                                    "requester_name": sender_name,
                                    "expires_at": expires_at.isoformat() + "Z"
                                }
                            }, str(g['guardian_user_id'])))
                        except Exception as notif_err:
                            logger.warning(f"Failed to push guardian notification: {notif_err}")

                    conn.commit()

                    raise HTTPException(
                        status_code=423, # Locked / Awaiting Guardian Approval
                        detail=f"🛡️ GUARDIAN APPROVAL REQUIRED: Cumulative limit of ₹{spending_limit:,.2f} exceeded. Approval request sent to guardian."
                    )

            # Atomic Settlement: Deduct sender & Credit receiver
            updated_sender_balance = sender_balance - amount
            cursor.execute("UPDATE auth_users SET balance = %s WHERE phone = %s", (updated_sender_balance, sender_phone))
            cursor.execute("UPDATE auth_users SET balance = COALESCE(balance, 100000.0) + %s WHERE phone = %s", (amount, receiver_phone))

            if has_active_guardians:
                _increment_cumulative_spent(cursor, sender_id, amount)

            # Record Transaction in ledger
            status_str = "APPROVED" if decision == "APPROVE" else "REVIEWED"
            cursor.execute("""
                INSERT INTO transactions (transaction_id, sender_vpa, receiver_vpa, amount, currency, txn_type, status, decision, risk_score)
                VALUES (%s, %s, %s, %s, 'INR', 'P2P', %s, %s, %s)
                ON CONFLICT (transaction_id) DO NOTHING
            """, (txn_id, sender_vpa, receiver_vpa, amount, status_str, decision, risk_score))
            conn.commit()

            logger.info(f"P2P Transfer settled: {sender_phone} → {receiver_phone} | ₹{amount} | Sender Balance: ₹{updated_sender_balance}")
            
            ts_str = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

            # Dispatch real-time WebSocket event & persistent notification to receiver
            try:
                from app.api.v1.guardian import manager
                from app.api.v1.notifications import add_notification_item

                payment_notif_payload = {
                    "type": "PAYMENT_RECEIVED",
                    "data": {
                        "transaction_id": txn_id,
                        "sender_vpa": sender_vpa,
                        "sender_name": sender_name,
                        "receiver_vpa": receiver_vpa,
                        "amount": amount,
                        "status": status_str,
                        "timestamp": ts_str
                    }
                }

                await manager.send_personal_message(payment_notif_payload, receiver_id)
                await manager.send_personal_message(payment_notif_payload, receiver_phone)
                await manager.send_personal_message(payment_notif_payload, receiver_vpa)
                
                payment_sent_payload = {
                    "type": "PAYMENT_SENT",
                    "data": {
                        "transaction_id": txn_id,
                        "receiver_vpa": receiver_vpa,
                        "receiver_name": receiver_row.get('name') or receiver_vpa,
                        "sender_vpa": sender_vpa,
                        "amount": amount,
                        "status": status_str,
                        "timestamp": ts_str
                    }
                }
                
                await manager.send_personal_message(payment_sent_payload, str(sender_row['id']))
                await manager.send_personal_message(payment_sent_payload, sender_phone)
                await manager.send_personal_message(payment_sent_payload, sender_vpa)

                add_notification_item(
                    title="💰 Payment Received",
                    body=f"Received ₹{amount:,.2f} from {sender_name} ({sender_vpa}). Ref: {txn_id}",
                    type_str="PAYMENT_RECEIVED",
                    txn_id=txn_id,
                    user_key=receiver_vpa
                )
                add_notification_item(
                    title="💸 Payment Sent",
                    body=f"Sent ₹{amount:,.2f} to {receiver_row.get('name') or receiver_vpa} ({receiver_vpa}). Ref: {txn_id}",
                    type_str="PAYMENT_SENT",
                    txn_id=txn_id,
                    user_key=sender_vpa
                )
            except Exception as notif_err:
                logger.warning(f"Failed to dispatch real-time payment notification: {notif_err}")

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
