"""
Guardian API Endpoints & WebSocket Server.
Phase 9: SentinelPay Advanced Features.

Endpoints:
- GET /guardian/list - List guardians and ward requests
- POST /guardian/add - Add a guardian by VPA/phone
- POST /guardian/accept-invitation - Accept a guardian request
- POST /guardian/remove - Revoke/remove a guardian relationship
- POST /guardian/request-approval - Ask guardians to approve a high-risk transaction
- POST /guardian/respond - Guardian approves/rejects a pending transaction
- GET /guardian/pending-requests - List pending approval requests (incoming & outgoing)
- WS /guardian/ws - Real-time WebSocket channel for requests & approval push

Requirements: 2.1 - 2.15
"""

from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict
import json
import logging
import random
import uuid
from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
import psycopg
from psycopg.rows import dict_row

from app.api.v1.auth import get_current_user, get_db, verify_access_token

logger = logging.getLogger("fraudshield.api.guardian")
router = APIRouter()

# In-Memory store for OTP verification codes (ephemeral by design)
GUARDIAN_VERIFICATION_CODES: Dict[str, dict] = {} # rel_id -> { code, expires_at, guardian_phone }


# ─── DB-Backed Config Helpers ─────────────────────────────────────────────────

def _get_ward_config(cursor, ward_user_id: str) -> dict:
    """Fetch the tightest (minimum) spending limit config for a ward from guardian_ward_config."""
    cursor.execute("""
        SELECT gwc.spending_limit, gwc.timeout_minutes, gwc.cumulative_spent,
               gwc.guardian_user_id, gwc.last_reset_at
        FROM guardian_ward_config gwc
        JOIN guardian_relationships gr
            ON gwc.ward_user_id = gr.user_id AND gwc.guardian_user_id = gr.guardian_user_id
        WHERE gwc.ward_user_id::text = %s AND gr.status = 'ACTIVE'
        ORDER BY gwc.spending_limit ASC
        LIMIT 1
    """, (str(ward_user_id),))
    row = cursor.fetchone()
    if row:
        return {
            "spending_limit": float(row['spending_limit']),
            "timeout_minutes": int(row['timeout_minutes']),
            "cumulative_spent": float(row['cumulative_spent']),
            "remaining_limit": max(0.0, float(row['spending_limit']) - float(row['cumulative_spent'])),
            "guardian_user_id": str(row['guardian_user_id']),
            "last_reset_at": row['last_reset_at'].isoformat() if row.get('last_reset_at') else None,
        }
    return {
        "spending_limit": 5000.0,
        "timeout_minutes": 5,
        "cumulative_spent": 0.0,
        "remaining_limit": 5000.0,
        "guardian_user_id": None,
        "last_reset_at": None,
    }


def _get_ward_config_by_vpa(cursor, ward_vpa: str) -> dict:
    """Fetch ward config using VPA lookup."""
    cursor.execute("SELECT id FROM auth_users WHERE LOWER(vpa) = %s", (ward_vpa.strip().lower(),))
    user_row = cursor.fetchone()
    if user_row:
        return _get_ward_config(cursor, str(user_row['id']))
    return _get_ward_config(cursor, ward_vpa)


def _upsert_ward_config(cursor, ward_user_id: str, guardian_user_id: str, limit: float, timeout_minutes: int):
    """Insert or update guardian_ward_config row."""
    cursor.execute("""
        INSERT INTO guardian_ward_config (ward_user_id, guardian_user_id, spending_limit, timeout_minutes, updated_at)
        VALUES (%s::uuid, %s::uuid, %s, %s, NOW())
        ON CONFLICT (ward_user_id, guardian_user_id)
        DO UPDATE SET spending_limit = EXCLUDED.spending_limit,
                     timeout_minutes = EXCLUDED.timeout_minutes,
                     updated_at = NOW()
    """, (ward_user_id, guardian_user_id, limit, timeout_minutes))


def _increment_cumulative_spent(cursor, ward_user_id: str, amount: float):
    """Atomically increment cumulative_spent for all configs of a ward."""
    cursor.execute("""
        UPDATE guardian_ward_config
        SET cumulative_spent = cumulative_spent + %s, updated_at = NOW()
        WHERE ward_user_id::text = %s
    """, (amount, str(ward_user_id)))


# ─── Request/Response Models ──────────────────────────────────────────────────

class AddGuardianRequest(BaseModel):
    phone: Optional[str] = None
    vpa: Optional[str] = None


class VerifyGuardianCodeRequest(BaseModel):
    relationship_id: str
    code: str


class RespondInvitationRequest(BaseModel):
    relationship_id: str
    decision: str = Field(..., pattern='^(APPROVE|REJECT)$')



class SetGuardianLimitRequest(BaseModel):
    limit: float = Field(..., gt=0)
    ward_vpa: Optional[str] = None
    ward_phone: Optional[str] = None


class SetWardConfigRequest(BaseModel):
    ward_vpa: Optional[str] = None
    ward_phone: Optional[str] = None
    ward_id: Optional[str] = None
    limit: float = Field(..., gt=0)
    timeout_minutes: int = Field(5, ge=1, le=60)


class RespondApprovalRequest(BaseModel):
    request_id: str
    decision: str = Field(..., pattern='^(APPROVED|REJECTED)$')
    note: Optional[str] = None


class CheckLimitRequest(BaseModel):
    amount: float = Field(..., gt=0)


class ResetSpendingRequest(BaseModel):
    ward_vpa: Optional[str] = None
    ward_phone: Optional[str] = None
    ward_id: Optional[str] = None


class CreateApprovalRequest(BaseModel):
    transaction_id: str
    amount: float
    recipient_vpa: str
    fraud_score: float
    risk_signals: List[str] = []


# ─── WebSocket Connection Manager ─────────────────────────────────────────────

class ConnectionManager:
    """Manages active WebSocket connections mapped by user_id."""
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, user_id: str, websocket: WebSocket):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)
        logger.info(f"WebSocket connected for user {user_id}. Active connections: {len(self.active_connections[user_id])}")

    def disconnect(self, user_id: str, websocket: WebSocket):
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
        logger.info(f"WebSocket disconnected for user {user_id}")

    async def send_personal_message(self, message: dict, user_id: str):
        """Sends a JSON message to all active WebSockets of a specific user."""
        if user_id in self.active_connections:
            for connection in self.active_connections[user_id]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.warning(f"Failed to send WebSocket message to {user_id}: {str(e)}")

    async def broadcast(self, message: dict):
        """Broadcasts JSON message to all connected clients."""
        for user_id, connections in self.active_connections.items():
            for connection in connections:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.warning(f"Failed to broadcast WebSocket message: {str(e)}")


manager = ConnectionManager()


# ─── WebSocket Endpoint ───────────────────────────────────────────────────────

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: Optional[str] = None):
    """
    WebSocket channel for real-time notifications.
    Clients connect using `ws://localhost:8000/api/v1/guardian/ws?token=<JWT>`
    """
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    
    try:
        payload = verify_access_token(token)
        user_id = payload.get("user_id")
        if not user_id:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
    except Exception as e:
        logger.error(f"WebSocket auth failed: {str(e)}")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await manager.connect(user_id, websocket)
    try:
        while True:
            # Maintain connection & listen for pings
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(user_id, websocket)
    except Exception as e:
        logger.error(f"WebSocket connection error: {str(e)}")
        manager.disconnect(user_id, websocket)


# ─── REST Endpoints ───────────────────────────────────────────────────────────

@router.get("/list")
async def list_guardians(current_user: dict = Depends(get_current_user)):
    """
    List all guardians protecting the user, and all wards they are protecting.
    Automatically expires verification codes older than 5 minutes.
    """
    conn = get_db()
    try:
        with conn.cursor() as cursor:
            # Auto-expire codes that passed 5-minute window
            cursor.execute("""
                UPDATE guardian_relationships
                SET status = 'EXPIRED', verification_code = NULL, updated_at = NOW()
                WHERE status IN ('PENDING', 'APPROVED')
                  AND code_expires_at IS NOT NULL
                  AND code_expires_at < NOW()
            """)
            conn.commit()

            # 1. Fetch guardians protecting current user
            cursor.execute("""
                SELECT gr.id, gr.guardian_phone, gr.guardian_vpa, gr.status, gr.invited_at, gr.accepted_at, gr.code_expires_at,
                       u.name as guardian_name
                FROM guardian_relationships gr
                LEFT JOIN auth_users u ON gr.guardian_user_id = u.id
                WHERE gr.user_id = %s AND gr.status NOT IN ('REMOVED', 'REJECTED')
                ORDER BY gr.created_at DESC
            """, (current_user['user_id'],))
            my_guardians = cursor.fetchall()

            # 2. Fetch wards (users who current user is guardian of)
            cursor.execute("""
                SELECT gr.id, gr.status, gr.verification_code, gr.code_expires_at, gr.invited_at, gr.accepted_at,
                       u.name as ward_name, u.phone as ward_phone, u.vpa as ward_vpa
                FROM guardian_relationships gr
                JOIN auth_users u ON gr.user_id = u.id
                WHERE gr.guardian_user_id = %s AND gr.status NOT IN ('REMOVED', 'REJECTED')
                ORDER BY gr.created_at DESC
            """, (current_user['user_id'],))
            my_wards = cursor.fetchall()

            for g in my_guardians:
                g_id = str(g['id'])
                g['id'] = g_id
                g['invited_at'] = g['invited_at'].isoformat() if g.get('invited_at') else None
                g['accepted_at'] = g['accepted_at'].isoformat() if g.get('accepted_at') else None
                g['code_expires_at'] = g['code_expires_at'].isoformat() if g.get('code_expires_at') else None

            for w in my_wards:
                w_id = str(w['id'])
                w['id'] = w_id
                w['invited_at'] = w['invited_at'].isoformat() if w.get('invited_at') else None
                w['accepted_at'] = w['accepted_at'].isoformat() if w.get('accepted_at') else None
                w['code_expires_at'] = w['code_expires_at'].isoformat() if w.get('code_expires_at') else None

                # Fallback code from in-memory cache if DB column is null
                if not w.get('verification_code') and w_id in GUARDIAN_VERIFICATION_CODES:
                    w['verification_code'] = GUARDIAN_VERIFICATION_CODES[w_id].get("code")

                ward_user_id = None
                ward_vpa = (w.get('ward_vpa') or "").strip().lower()
                if ward_vpa:
                    cursor.execute("SELECT id FROM auth_users WHERE LOWER(vpa) = %s", (ward_vpa,))
                    ward_user_row = cursor.fetchone()
                    if ward_user_row:
                        ward_user_id = str(ward_user_row['id'])

                if ward_user_id:
                    ward_cfg = _get_ward_config(cursor, ward_user_id)
                else:
                    ward_cfg = {"spending_limit": 5000.0, "timeout_minutes": 5, "cumulative_spent": 0.0, "remaining_limit": 5000.0}

                w['cumulative_spent'] = ward_cfg['cumulative_spent']
                w['spending_limit'] = ward_cfg['spending_limit']
                w['remaining_limit'] = ward_cfg['remaining_limit']
                w['timeout_minutes'] = ward_cfg['timeout_minutes']

            return {
                "guardians": my_guardians,
                "wards": my_wards
            }
    except Exception as e:
        logger.error(f"Failed to list guardians: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to list guardians: {str(e)}")
    finally:
        conn.close()


@router.post("/add")
async def add_guardian(req: AddGuardianRequest, current_user: dict = Depends(get_current_user)):
    """
    Invite a new guardian by phone or VPA.
    Generates a secure 6-digit OTP verification code valid for 5 minutes stored in DB.
    """
    if not req.phone and not req.vpa:
        raise HTTPException(status_code=400, detail="Must provide phone or VPA")
    
    conn = get_db()
    try:
        with conn.cursor() as cursor:
            if req.vpa:
                cursor.execute("SELECT id, name, phone, vpa FROM auth_users WHERE LOWER(vpa) = %s", (req.vpa.strip().lower(),))
            else:
                cursor.execute("SELECT id, name, phone, vpa FROM auth_users WHERE phone = %s", (req.phone.strip(),))
            
            guardian_user = cursor.fetchone()
            if not guardian_user:
                raise HTTPException(
                    status_code=404, 
                    detail="Guardian account not found. Guardians must have an active SentinelPay account."
                )

            guardian_id = guardian_user['id']
            guardian_phone = guardian_user['phone']
            guardian_vpa = guardian_user['vpa']

            if str(guardian_id) == str(current_user['user_id']):
                raise HTTPException(status_code=400, detail="You cannot add yourself as a guardian")

            # Check max 5 active guardians limit
            cursor.execute("""
                SELECT COUNT(*) as count FROM guardian_relationships
                WHERE user_id = %s AND status = 'ACTIVE'
            """, (current_user['user_id'],))
            active_count = cursor.fetchone()['count']
            if active_count >= 5:
                raise HTTPException(status_code=400, detail="You already have the maximum limit of 5 active guardians")

            # Check if relationship already exists
            cursor.execute("""
                SELECT id, status FROM guardian_relationships
                WHERE user_id = %s AND guardian_user_id = %s
            """, (current_user['user_id'], guardian_id))
            existing = cursor.fetchone()

            # Generate random 6-digit OTP verification code (expires in 5 mins)
            verification_code = f"{random.randint(100000, 999999)}"
            code_expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)

            if existing:
                if existing['status'] == 'ACTIVE':
                    raise HTTPException(status_code=409, detail="Guardian relationship is already ACTIVE")
                else:
                    rel_id = str(existing['id'])
                    cursor.execute("""
                        UPDATE guardian_relationships
                        SET status = 'PENDING',
                            verification_code = %s,
                            code_expires_at = %s,
                            invited_at = NOW(),
                            accepted_at = NULL,
                            rejected_at = NULL,
                            removed_at = NULL,
                            updated_at = NOW()
                        WHERE id = %s
                    """, (verification_code, code_expires_at, existing['id']))
                    conn.commit()
            else:
                cursor.execute("""
                    INSERT INTO guardian_relationships (user_id, guardian_phone, guardian_vpa, guardian_user_id, status, verification_code, code_expires_at)
                    VALUES (%s, %s, %s, %s, 'PENDING', %s, %s)
                    RETURNING id
                """, (current_user['user_id'], guardian_phone, guardian_vpa, guardian_id, verification_code, code_expires_at))
                new_rel = cursor.fetchone()
                conn.commit()
                rel_id = str(new_rel['id'])

            GUARDIAN_VERIFICATION_CODES[rel_id] = {
                "code": verification_code,
                "guardian_phone": guardian_phone,
                "expires_at": code_expires_at
            }

            # Push real-time WebSocket notification to Guardian device
            await manager.send_personal_message({
                "type": "GUARDIAN_INVITATION",
                "data": {
                    "relationship_id": rel_id,
                    "code": verification_code,
                    "expires_at": code_expires_at.isoformat(),
                    "inviter_name": current_user.get("name") or current_user.get("phone") or "Sentinel User",
                    "inviter_phone": current_user.get("phone"),
                    "inviter_vpa": current_user.get("vpa")
                }
            }, str(guardian_id))

            # Also push notification event to Ward device
            await manager.send_personal_message({
                "type": "GUARDIAN_VERIFICATION_CODE",
                "data": {
                    "relationship_id": rel_id,
                    "code": verification_code,
                    "inviter_name": current_user.get("name") or current_user.get("phone") or "Sentinel User",
                    "inviter_phone": current_user.get("phone")
                }
            }, str(guardian_id))

            return {
                "relationship_id": rel_id,
                "status": "PENDING_VERIFICATION",
                "verification_code": verification_code,
                "expires_at": code_expires_at.isoformat(),
                "message": "Guardian verification code generated."
            }
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        logger.error(f"Failed to add guardian: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to add guardian: {str(e)}")
    finally:
        conn.close()


@router.post("/invitation/respond")
async def respond_invitation(req: RespondInvitationRequest, current_user: dict = Depends(get_current_user)):
    """
    Guardian responds to a ward's pending invitation (APPROVE or REJECT).
    - APPROVE: Marks status as APPROVED. Keeps the verification code active for Ward to enter.
    - REJECT: Marks status as REJECTED, invalidates the verification code immediately.
    """
    rel_id = req.relationship_id.strip()
    decision = req.decision.upper()

    conn = get_db()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT gr.id, gr.user_id, gr.guardian_user_id, gr.status, gr.verification_code, gr.code_expires_at,
                       u.name as ward_name, u.phone as ward_phone
                FROM guardian_relationships gr
                JOIN auth_users u ON gr.user_id = u.id
                WHERE gr.id::text = %s AND gr.guardian_user_id = %s
            """, (rel_id, current_user['user_id']))
            rel = cursor.fetchone()

            if not rel:
                raise HTTPException(status_code=404, detail="Guardian invitation request not found.")

            ward_id = str(rel['user_id'])

            if decision == 'REJECT':
                cursor.execute("""
                    UPDATE guardian_relationships
                    SET status = 'REJECTED', rejected_at = NOW(), verification_code = NULL, code_expires_at = NULL, updated_at = NOW()
                    WHERE id = %s
                """, (rel['id'],))
                conn.commit()
                GUARDIAN_VERIFICATION_CODES.pop(rel_id, None)

                # Notify Ward via WebSocket
                await manager.send_personal_message({
                    "type": "GUARDIAN_INVITATION_REJECTED",
                    "data": {
                        "relationship_id": rel_id,
                        "guardian_name": current_user.get("name") or current_user.get("phone") or "Sentinel Guardian",
                        "message": "Guardian rejected your invitation."
                    }
                }, ward_id)

                return {"success": True, "status": "REJECTED", "message": "Invitation rejected."}

            else:  # APPROVE
                cursor.execute("""
                    UPDATE guardian_relationships
                    SET status = 'APPROVED', accepted_at = NOW(), updated_at = NOW()
                    WHERE id = %s
                """, (rel['id'],))
                conn.commit()

                # Notify Ward via WebSocket
                await manager.send_personal_message({
                    "type": "GUARDIAN_INVITATION_APPROVED",
                    "data": {
                        "relationship_id": rel_id,
                        "guardian_name": current_user.get("name") or current_user.get("phone") or "Sentinel Guardian",
                        "code": rel.get("verification_code"),
                        "message": "Guardian approved your invitation! Enter the code displayed on Guardian's screen to complete setup."
                    }
                }, ward_id)

                return {"success": True, "status": "APPROVED", "message": "Invitation approved. Code remains active for Ward verification."}
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        logger.error(f"Failed to respond to invitation: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to respond to invitation: {str(e)}")
    finally:
        conn.close()


@router.post("/verify-code")
async def verify_guardian_code(req: VerifyGuardianCodeRequest, current_user: dict = Depends(get_current_user)):
    """
    Verify guardian code entered by Ward to activate relationship.
    Validates server-side against DB record and 5-minute expiry window.
    """
    rel_id = req.relationship_id.strip()
    user_code = req.code.strip()

    if not user_code:
        raise HTTPException(status_code=400, detail="Verification code is required.")

    conn = get_db()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT id, user_id, guardian_user_id, status, verification_code, code_expires_at
                FROM guardian_relationships
                WHERE id::text = %s AND user_id = %s
            """, (rel_id, current_user['user_id']))
            rel = cursor.fetchone()

            if not rel:
                raise HTTPException(status_code=404, detail="Guardian relationship invitation not found.")

            if rel['status'] == 'ACTIVE':
                raise HTTPException(status_code=400, detail="Guardian relationship is already active or code has already been used.")

            if rel['status'] == 'REJECTED':
                raise HTTPException(status_code=400, detail="Guardian rejected this invitation.")

            if rel['status'] == 'EXPIRED':
                raise HTTPException(status_code=400, detail="Verification code has expired. Please request a new invitation.")

            now_utc = datetime.now(timezone.utc)
            if rel.get('code_expires_at') and rel['code_expires_at'] < now_utc:
                cursor.execute("UPDATE guardian_relationships SET status = 'EXPIRED', verification_code = NULL WHERE id = %s", (rel['id'],))
                conn.commit()
                raise HTTPException(status_code=400, detail="Verification code has expired. Please request a new invitation.")

            # Validate code (DB record or in-memory fallback)
            db_code = rel.get('verification_code')
            mem_code = GUARDIAN_VERIFICATION_CODES.get(rel_id, {}).get("code")
            valid_code = (db_code or mem_code or "").strip()

            if not valid_code or valid_code != user_code:
                raise HTTPException(status_code=400, detail="Invalid verification code. Please check with your guardian.")

            # Code is valid! Mark ACTIVE & invalidate code (single-use only)
            cursor.execute("""
                UPDATE guardian_relationships
                SET status = 'ACTIVE', accepted_at = NOW(), verification_code = NULL, code_expires_at = NULL, updated_at = NOW()
                WHERE id = %s
                RETURNING user_id, guardian_user_id
            """, (rel['id'],))
            updated = cursor.fetchone()

            if updated and updated.get('guardian_user_id'):
                _upsert_ward_config(cursor, str(updated['user_id']), str(updated['guardian_user_id']), 5000.0, 5)

            conn.commit()
            GUARDIAN_VERIFICATION_CODES.pop(rel_id, None)

            # Notify Guardian via WebSocket
            if updated and updated.get('guardian_user_id'):
                await manager.send_personal_message({
                    "type": "GUARDIAN_LINKED",
                    "data": {
                        "relationship_id": rel_id,
                        "ward_name": current_user.get("name") or current_user.get("phone") or "Sentinel User",
                        "ward_phone": current_user.get("phone")
                    }
                }, str(updated['guardian_user_id']))

            return {"success": True, "status": "ACTIVE", "message": "Guardian successfully verified and linked!"}
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        logger.error(f"Failed to verify guardian code: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to verify code: {str(e)}")
    finally:
        conn.close()



@router.post("/set-limit")
async def set_guardian_limit(req: SetGuardianLimitRequest, current_user: dict = Depends(get_current_user)):
    """
    Set user's or ward's maximum transaction spending limit threshold.
    """
    conn = get_db()
    try:
        with conn.cursor() as cursor:
            ward_id = None
            if req.ward_vpa:
                cursor.execute("SELECT id FROM auth_users WHERE LOWER(vpa) = %s", (req.ward_vpa.strip().lower(),))
                row = cursor.fetchone()
                if row:
                    ward_id = str(row['id'])
            elif req.ward_phone:
                cursor.execute("SELECT id FROM auth_users WHERE phone = %s", (req.ward_phone.strip(),))
                row = cursor.fetchone()
                if row:
                    ward_id = str(row['id'])
            
            if not ward_id:
                ward_id = str(current_user['user_id'])

            _upsert_ward_config(cursor, ward_id, str(current_user['user_id']), req.limit, 5)
            conn.commit()

            return {"success": True, "limit": req.limit, "message": f"Guardian transaction limit set to ₹{req.limit:,.2f}"}
    except Exception as e:
        conn.rollback()
        logger.error(f"Failed to set limit: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to set limit: {str(e)}")
    finally:
        conn.close()


@router.post("/set-ward-config")
async def set_ward_config(req: SetWardConfigRequest, current_user: dict = Depends(get_current_user)):
    """
    Guardian configures spending limit and approval timeout duration for a ward.
    """
    key = (req.ward_vpa or req.ward_phone or req.ward_id or "").strip().lower()
    if not key:
        raise HTTPException(status_code=400, detail="Must provide ward_vpa, ward_phone, or ward_id")

    conn = get_db()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT id FROM auth_users
                WHERE LOWER(vpa) = %s OR phone = %s OR id::text = %s
            """, (key, key, key))
            ward_row = cursor.fetchone()
            if not ward_row:
                raise HTTPException(status_code=404, detail="Ward user not found")

            ward_id = str(ward_row['id'])
            guardian_id = str(current_user['user_id'])

            _upsert_ward_config(cursor, ward_id, guardian_id, req.limit, req.timeout_minutes)
            conn.commit()

            return {
                "success": True,
                "limit": req.limit,
                "timeout_minutes": req.timeout_minutes,
                "message": f"Ward config updated: Limit ₹{req.limit:,.2f}, Timeout {req.timeout_minutes}m"
            }
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        logger.error(f"Failed to set ward config: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to set ward config: {str(e)}")
    finally:
        conn.close()


@router.get("/get-limit")
async def get_guardian_limit(target_vpa: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """
    Get user's or target ward's spending limit threshold, cumulative spent, remaining limit, and timeout.
    """
    conn = get_db()
    try:
        with conn.cursor() as cursor:
            if target_vpa:
                cfg = _get_ward_config_by_vpa(cursor, target_vpa)
            else:
                cfg = _get_ward_config(cursor, str(current_user['user_id']))

            return {
                "limit": cfg['spending_limit'],
                "cumulative_spent": cfg['cumulative_spent'],
                "remaining_limit": cfg['remaining_limit'],
                "timeout_minutes": cfg['timeout_minutes']
            }
    except Exception as e:
        logger.error(f"Failed to get limit: {e}")
        return {"limit": 5000.0, "cumulative_spent": 0.0, "remaining_limit": 5000.0, "timeout_minutes": 5}
    finally:
        conn.close()


@router.post("/check-limit")
async def check_guardian_limit(req: CheckLimitRequest, current_user: dict = Depends(get_current_user)):
    """
    Check if transaction amount exceeds ward's remaining cumulative limit.
    Requirements: Phase 3 Transaction Enforcement
    """
    conn = get_db()
    try:
        with conn.cursor() as cursor:
            # Check if user has active guardians
            cursor.execute("""
                SELECT COUNT(*) as count FROM guardian_relationships
                WHERE user_id = %s AND status = 'ACTIVE'
            """, (current_user['user_id'],))
            row = cursor.fetchone()
            active_guardians = row['count'] if row else 0

            if active_guardians == 0:
                return {
                    "requires_approval": False,
                    "has_active_guardians": False,
                    "remaining_limit": 999999999.0
                }

            cfg = _get_ward_config(cursor, str(current_user['user_id']))
            spending_limit = cfg['spending_limit']
            cumulative_spent = cfg['cumulative_spent']
            remaining = cfg['remaining_limit']
            timeout_minutes = cfg['timeout_minutes']

            requires_approval = (cumulative_spent + req.amount) > spending_limit

            return {
                "requires_approval": requires_approval,
                "has_active_guardians": True,
                "spending_limit": spending_limit,
                "cumulative_spent": cumulative_spent,
                "remaining_limit": remaining,
                "requested_amount": req.amount,
                "timeout_minutes": timeout_minutes
            }
    except Exception as e:
        logger.error(f"Failed to check guardian limit: {e}")
        return {"requires_approval": False, "has_active_guardians": False, "remaining_limit": 5000.0}
    finally:
        conn.close()


@router.post("/reset-spending")
async def reset_ward_spending(req: ResetSpendingRequest, current_user: dict = Depends(get_current_user)):
    """
    Guardian resets cumulative spending counter for a ward.
    """
    key = (req.ward_vpa or req.ward_phone or req.ward_id or "").strip().lower()
    if not key:
        raise HTTPException(status_code=400, detail="Must provide ward_vpa, ward_phone, or ward_id")

    conn = get_db()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT id FROM auth_users
                WHERE LOWER(vpa) = %s OR phone = %s OR id::text = %s
            """, (key, key, key))
            ward_row = cursor.fetchone()
            if not ward_row:
                raise HTTPException(status_code=404, detail="Ward user not found")

            ward_id = str(ward_row['id'])
            cursor.execute("""
                UPDATE guardian_ward_config
                SET cumulative_spent = 0.0, last_reset_at = NOW(), updated_at = NOW()
                WHERE ward_user_id = %s::uuid AND guardian_user_id = %s::uuid
            """, (ward_id, str(current_user['user_id'])))
            conn.commit()

            return {"success": True, "message": "Cumulative spending counter reset to ₹0.00"}
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        logger.error(f"Failed to reset ward spending: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to reset ward spending: {str(e)}")
    finally:
        conn.close()


@router.get("/ward-details/{identifier}")
async def get_ward_details(identifier: str, current_user: dict = Depends(get_current_user)):
    """
    Fetch full profile, spending metrics, limit configuration, and transaction history for a specific ward.
    """
    conn = get_db()
    try:
        with conn.cursor() as cursor:
            clean_id = identifier.strip().lower()
            
            # Find ward user profile by VPA, Phone, or ID
            cursor.execute("""
                SELECT id, name, phone, vpa, balance FROM auth_users
                WHERE LOWER(vpa) = %s OR phone = %s OR id::text = %s
            """, (clean_id, clean_id, clean_id))
            ward_profile = cursor.fetchone()

            if not ward_profile:
                raise HTTPException(status_code=404, detail="Ward profile not found")

            ward_vpa = ward_profile['vpa']
            ward_id = str(ward_profile['id'])

            # Fetch ward transactions
            cursor.execute("""
                SELECT transaction_id, sender_vpa, receiver_vpa, amount, currency, status, decision, risk_score, created_at
                FROM transactions
                WHERE sender_vpa = %s OR receiver_vpa = %s
                ORDER BY created_at DESC
                LIMIT 50
            """, (ward_vpa, ward_vpa))
            txns = cursor.fetchall()
            for t in txns:
                t['created_at'] = t['created_at'].isoformat() if t.get('created_at') else None

            # Persistent config metrics
            cfg = _get_ward_config(cursor, ward_id)

            return {
                "ward": {
                    "id": ward_id,
                    "name": ward_profile['name'],
                    "phone": ward_profile['phone'],
                    "vpa": ward_profile['vpa'],
                    "balance": float(ward_profile['balance'] or 0.0)
                },
                "config": {
                    "limit": cfg['spending_limit'],
                    "timeout_minutes": cfg['timeout_minutes'],
                    "cumulative_spent": cfg['cumulative_spent'],
                    "remaining_limit": cfg['remaining_limit'],
                    "last_reset_at": cfg['last_reset_at']
                },
                "transactions": txns
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch ward details: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch ward details: {str(e)}")
    finally:
        conn.close()



@router.post("/accept-invitation")
async def accept_invitation(relationship_id: str, current_user: dict = Depends(get_current_user)):
    """
    Accept a pending guardian invitation.
    Requirements: 2.3
    """
    conn = get_db()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT gr.id, gr.user_id, gr.status, u.name as ward_name
                FROM guardian_relationships gr
                JOIN auth_users u ON gr.user_id = u.id
                WHERE gr.id::text = %s AND gr.guardian_user_id = %s
            """, (relationship_id, current_user['user_id']))
            rel = cursor.fetchone()

            if not rel:
                raise HTTPException(status_code=404, detail="Invitation not found or not assigned to you")
            
            if rel['status'] != 'PENDING':
                raise HTTPException(status_code=400, detail=f"Invitation is not in PENDING state (current: {rel['status']})")

            # Update status
            cursor.execute("""
                UPDATE guardian_relationships
                SET status = 'ACTIVE', accepted_at = NOW(), updated_at = NOW()
                WHERE id::text = %s
            """, (relationship_id,))

            _upsert_ward_config(cursor, str(rel['user_id']), str(current_user['user_id']), 5000.0, 5)
            conn.commit()

            # Notify ward via WebSocket
            await manager.send_personal_message({
                "type": "GUARDIAN_INVITATION_ACCEPTED",
                "data": {
                    "relationship_id": relationship_id,
                    "guardian_name": current_user.get("name") or current_user.get("phone") or "Sentinel User"
                }
            }, str(rel['user_id']))

            return {"success": True, "status": "ACTIVE"}
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        logger.error(f"Failed to accept invitation: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to accept invitation: {str(e)}")
    finally:
        conn.close()


@router.post("/remove")
async def remove_guardian(relationship_id: str, current_user: dict = Depends(get_current_user)):
    """
    Remove/Revoke a guardian relationship.
    Requirements: 2.4
    """
    conn = get_db()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT id, user_id, guardian_user_id, status FROM guardian_relationships
                WHERE id::text = %s AND (user_id = %s OR guardian_user_id = %s)
            """, (relationship_id, current_user['user_id'], current_user['user_id']))
            rel = cursor.fetchone()

            if not rel:
                raise HTTPException(status_code=404, detail="Relationship not found")

            if rel['status'] == 'REMOVED':
                return {"success": True, "status": "REMOVED"}

            cursor.execute("""
                UPDATE guardian_relationships
                SET status = 'REMOVED', removed_at = NOW(), updated_at = NOW()
                WHERE id::text = %s
            """, (relationship_id,))
            conn.commit()

            # Notify the other party
            other_user_id = str(rel['guardian_user_id']) if str(rel['user_id']) == str(current_user['user_id']) else str(rel['user_id'])
            await manager.send_personal_message({
                "type": "GUARDIAN_REMOVED",
                "data": {
                    "relationship_id": relationship_id
                }
            }, other_user_id)

            return {"success": True, "status": "REMOVED"}
    except Exception as e:
        conn.rollback()
        logger.error(f"Failed to remove relationship: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to remove relationship: {str(e)}")
    finally:
        conn.close()


@router.post("/request-approval")
async def request_approval(req: CreateApprovalRequest, current_user: dict = Depends(get_current_user)):
    """
    Request approval for a high-risk transaction from all active guardians.
    Requirements: 2.5, 2.6, 2.10
    """
    conn = get_db()
    try:
        with conn.cursor() as cursor:
            # Fetch active guardians
            cursor.execute("""
                SELECT id, guardian_user_id FROM guardian_relationships
                WHERE user_id = %s AND status = 'ACTIVE'
            """, (current_user['user_id'],))
            guardians = cursor.fetchall()

            if not guardians:
                raise HTTPException(status_code=400, detail="You have no active guardians configured.")

            # Determine dynamic timeout duration from persistent guardian_ward_config
            cfg = _get_ward_config(cursor, str(current_user['user_id']))
            timeout_mins = cfg.get("timeout_minutes", 5)

            expires_at = datetime.now(timezone.utc) + timedelta(minutes=timeout_mins)
            created_requests = []

            for g in guardians:
                cursor.execute("""
                    INSERT INTO guardian_approval_requests (transaction_id, user_id, guardian_id, amount, recipient_vpa, fraud_score, risk_signals, expires_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                """, (
                    req.transaction_id,
                    current_user['user_id'],
                    g['id'],
                    req.amount,
                    req.recipient_vpa,
                    req.fraud_score,
                    json.dumps(req.risk_signals),
                    expires_at
                ))
                new_req = cursor.fetchone()
                created_requests.append({
                    "request_id": str(new_req['id']),
                    "guardian_user_id": str(g['guardian_user_id'])
                })

            conn.commit()

            # Push notifications to guardians via WebSocket
            for r in created_requests:
                await manager.send_personal_message({
                    "type": "APPROVAL_REQUEST",
                    "data": {
                        "request_id": r['request_id'],
                        "transaction_id": req.transaction_id,
                        "amount": req.amount,
                        "recipient_vpa": req.recipient_vpa,
                        "fraud_score": req.fraud_score,
                        "risk_signals": req.risk_signals,
                        "requester_name": current_user.get("name") or current_user.get("phone") or "Sentinel User",
                        "expires_at": expires_at.isoformat() + "Z"
                    }
                }, r['guardian_user_id'])

            return {
                "success": True,
                "requests": [r['request_id'] for r in created_requests],
                "expires_at": expires_at.isoformat() + "Z"
            }
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        logger.error(f"Failed to create approval request: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to create approval request: {str(e)}")
    finally:
        conn.close()


@router.post("/respond")
async def respond_to_request(req: RespondApprovalRequest, current_user: dict = Depends(get_current_user)):
    """
    Approve or Reject a pending transaction request as a guardian.
    Handles race conditions with SELECT FOR UPDATE row locking.
    Requirements: 2.7, 2.8, 2.9, Phase 4 Approval Process
    """
    conn = get_db()
    try:
        with conn.cursor() as cursor:
            # Atomic row locking to prevent duplicate responses / race conditions
            cursor.execute("""
                SELECT gar.id, gar.transaction_id, gar.user_id, gar.amount, gar.recipient_vpa, gar.status, gar.expires_at,
                       gr.guardian_user_id
                FROM guardian_approval_requests gar
                LEFT JOIN guardian_relationships gr ON gar.guardian_id = gr.id
                WHERE (gar.id::text = %s OR gar.transaction_id = %s)
                FOR UPDATE OF gar
            """, (req.request_id, req.request_id))
            approval_req = cursor.fetchone()

            if not approval_req:
                raise HTTPException(status_code=404, detail="Approval request not found or not assigned to you")

            if approval_req['status'] != 'PENDING':
                raise HTTPException(status_code=400, detail=f"Request is already resolved (status: {approval_req['status']})")

            # Check expiration
            expires_at = approval_req['expires_at']
            now_time = datetime.now(timezone.utc)
            if expires_at < now_time:
                cursor.execute("""
                    UPDATE guardian_approval_requests
                    SET status = 'EXPIRED'
                    WHERE id::text = %s OR transaction_id = %s
                """, (req.request_id, req.request_id))
                
                # Also mark transaction as EXPIRED / CANCELLED in ledger
                cursor.execute("""
                    UPDATE transactions
                    SET status = 'EXPIRED'
                    WHERE transaction_id = %s
                """, (approval_req['transaction_id'],))
                
                conn.commit()
                raise HTTPException(status_code=400, detail="Request has expired")

            # Update request status
            cursor.execute("""
                UPDATE guardian_approval_requests
                SET status = %s, responded_at = NOW(), response_note = %s
                WHERE id::text = %s OR transaction_id = %s
            """, (req.decision, req.note, req.request_id, req.request_id))

            txn_id = approval_req['transaction_id']
            ward_user_id = str(approval_req['user_id'])
            amount = float(approval_req['amount'])

            if req.decision == 'APPROVED':
                # Increment cumulative spent for the ward
                _increment_cumulative_spent(cursor, ward_user_id, amount)
                
                # Update transaction status in ledger to APPROVED
                cursor.execute("""
                    UPDATE transactions
                    SET status = 'APPROVED', decision = 'APPROVE'
                    WHERE transaction_id = %s
                """, (txn_id,))
            else:
                # REJECTED -> mark transaction as REJECTED / CANCELLED
                cursor.execute("""
                    UPDATE transactions
                    SET status = 'REJECTED', decision = 'REJECT'
                    WHERE transaction_id = %s
                """, (txn_id,))

            conn.commit()

            # Push response to requester via WebSocket
            await manager.send_personal_message({
                "type": "APPROVAL_RESPONSE",
                "data": {
                    "request_id": req.request_id,
                    "transaction_id": txn_id,
                    "status": req.decision,
                    "guardian_name": current_user.get("name") or current_user.get("phone") or "Sentinel User",
                    "note": req.note
                }
            }, ward_user_id)

            return {"success": True, "status": req.decision}
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        logger.error(f"Failed to respond to request: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to respond to request: {str(e)}")
    finally:
        conn.close()


@router.get("/pending-requests")
async def pending_requests(current_user: dict = Depends(get_current_user)):
    """
    Get all incoming pending requests (assigned to me as a guardian) 
    and outgoing pending requests (created by me).
    Requirements: 2.13
    """
    conn = get_db()
    try:
        with conn.cursor() as cursor:
            # 1. Fetch incoming requests
            cursor.execute("""
                SELECT gar.id, gar.transaction_id, gar.amount, gar.recipient_vpa, gar.fraud_score, gar.risk_signals, gar.expires_at, gar.created_at,
                       u.name as requester_name, u.phone as requester_phone
                FROM guardian_approval_requests gar
                JOIN guardian_relationships gr ON gar.guardian_id = gr.id
                JOIN auth_users u ON gar.user_id = u.id
                WHERE gr.guardian_user_id = %s AND gar.status = 'PENDING' AND gar.expires_at > NOW()
            """, (current_user['user_id'],))
            incoming = cursor.fetchall()

            # 2. Fetch outgoing requests
            cursor.execute("""
                SELECT gar.id, gar.transaction_id, gar.amount, gar.recipient_vpa, gar.fraud_score, gar.risk_signals, gar.expires_at, gar.status, gar.created_at,
                       u.name as guardian_name, u.phone as guardian_phone
                FROM guardian_approval_requests gar
                JOIN guardian_relationships gr ON gar.guardian_id = gr.id
                JOIN auth_users u ON gr.guardian_user_id = u.id
                WHERE gar.user_id = %s AND gar.status = 'PENDING' AND gar.expires_at > NOW()
            """, (current_user['user_id'],))
            outgoing = cursor.fetchall()

            # Format datetime columns to ISO string
            for r in incoming:
                r['id'] = str(r['id'])
                r['expires_at'] = r['expires_at'].isoformat() if r['expires_at'] else None
                r['created_at'] = r['created_at'].isoformat() if r['created_at'] else None
                if isinstance(r['risk_signals'], str):
                    r['risk_signals'] = json.loads(r['risk_signals'])

            for r in outgoing:
                r['id'] = str(r['id'])
                r['expires_at'] = r['expires_at'].isoformat() if r['expires_at'] else None
                r['created_at'] = r['created_at'].isoformat() if r['created_at'] else None
                if isinstance(r['risk_signals'], str):
                    r['risk_signals'] = json.loads(r['risk_signals'])

            return {
                "incoming": incoming,
                "outgoing": outgoing
            }
    except Exception as e:
        logger.error(f"Failed to fetch pending requests: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch pending requests: {str(e)}")
    finally:
        conn.close()


@router.get("/request-status/{transaction_id}")
async def request_status(transaction_id: str, current_user: dict = Depends(get_current_user)):
    """
    Get the status of an approval request for a specific transaction ID.
    Used as polling fallback.
    """
    conn = get_db()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT gar.status, u.name as guardian_name, gar.response_note
                FROM guardian_approval_requests gar
                JOIN guardian_relationships gr ON gar.guardian_id = gr.id
                JOIN auth_users u ON gr.guardian_user_id = u.id
                WHERE gar.transaction_id = %s AND gar.user_id = %s
                ORDER BY gar.created_at DESC
                LIMIT 1
            """, (transaction_id, current_user['user_id']))
            req = cursor.fetchone()
            if not req:
                return {"status": "NONE"}
            return {
                "status": req['status'],
                "guardian_name": req['guardian_name'],
                "note": req['response_note']
            }
    except Exception as e:
        logger.error(f"Failed to fetch request status: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch request status: {str(e)}")
    finally:
        conn.close()
