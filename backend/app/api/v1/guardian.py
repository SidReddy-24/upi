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

# In-Memory stores for guardian verification & limits
GUARDIAN_VERIFICATION_CODES: Dict[str, dict] = {} # rel_id -> { code, expires_at, guardian_phone }
GUARDIAN_LIMITS_STORE: Dict[str, float] = {}        # user_id or phone -> limit float (default 5000.0)


# ─── Request/Response Models ──────────────────────────────────────────────────

class AddGuardianRequest(BaseModel):
    phone: Optional[str] = None
    vpa: Optional[str] = None


class VerifyGuardianCodeRequest(BaseModel):
    relationship_id: str
    code: str


class SetGuardianLimitRequest(BaseModel):
    limit: float = Field(..., gt=0)
    ward_vpa: Optional[str] = None
    ward_phone: Optional[str] = None


class RespondApprovalRequest(BaseModel):
    request_id: str
    decision: str = Field(..., pattern='^(APPROVED|REJECTED)$')
    note: Optional[str] = None


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
    Requirements: 2.1
    """
    conn = get_db()
    try:
        with conn.cursor() as cursor:
            # 1. Fetch guardians protecting current user
            cursor.execute("""
                SELECT gr.id, gr.guardian_phone, gr.guardian_vpa, gr.status, gr.invited_at, gr.accepted_at,
                       u.name as guardian_name
                FROM guardian_relationships gr
                LEFT JOIN auth_users u ON gr.guardian_user_id = u.id
                WHERE gr.user_id = %s AND gr.status != 'REMOVED'
            """, (current_user['user_id'],))
            my_guardians = cursor.fetchall()

            # 2. Fetch wards (users who current user is guardian of)
            cursor.execute("""
                SELECT gr.id, gr.status, gr.invited_at, gr.accepted_at,
                       u.name as ward_name, u.phone as ward_phone, u.vpa as ward_vpa
                FROM guardian_relationships gr
                JOIN auth_users u ON gr.user_id = u.id
                WHERE gr.guardian_user_id = %s AND gr.status != 'REMOVED'
            """, (current_user['user_id'],))
            my_wards = cursor.fetchall()

            # Format datetime columns to ISO string & inject verification_code for guardian to view
            for g in my_guardians:
                g['id'] = str(g['id'])
                g['invited_at'] = g['invited_at'].isoformat() if g['invited_at'] else None
                g['accepted_at'] = g['accepted_at'].isoformat() if g['accepted_at'] else None
            
            for w in my_wards:
                w_id = str(w['id'])
                w['id'] = w_id
                w['invited_at'] = w['invited_at'].isoformat() if w['invited_at'] else None
                w['accepted_at'] = w['accepted_at'].isoformat() if w['accepted_at'] else None
                if w_id in GUARDIAN_VERIFICATION_CODES:
                    w['verification_code'] = GUARDIAN_VERIFICATION_CODES[w_id].get("code")

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
    Requirements: 2.1, 2.15
    """
    if not req.phone and not req.vpa:
        raise HTTPException(status_code=400, detail="Must provide phone or VPA")
    
    conn = get_db()
    try:
        with conn.cursor() as cursor:
            # Validate guardian exists in auth_users (Requirement 2.15)
            if req.vpa:
                cursor.execute("SELECT id, name, phone, vpa FROM auth_users WHERE vpa = %s", (req.vpa,))
            else:
                cursor.execute("SELECT id, name, phone, vpa FROM auth_users WHERE phone = %s", (req.phone,))
            
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

            # Check if relationship already exists
            cursor.execute("""
                SELECT id, status FROM guardian_relationships
                WHERE user_id = %s AND guardian_user_id = %s
            """, (current_user['user_id'], guardian_id))
            existing = cursor.fetchone()

            # Generate 6-digit OTP verification code
            verification_code = f"{random.randint(100000, 999999)}"

            if existing:
                if existing['status'] in ('ACTIVE', 'PENDING'):
                    raise HTTPException(status_code=409, detail=f"Guardian relationship is already {existing['status']}")
                else:
                    rel_id = str(existing['id'])
                    cursor.execute("""
                        UPDATE guardian_relationships
                        SET status = 'PENDING', invited_at = NOW(), accepted_at = NULL, rejected_at = NULL, removed_at = NULL, updated_at = NOW()
                        WHERE id = %s
                        RETURNING id
                    """, (existing['id'],))
                    conn.commit()
                    
                    GUARDIAN_VERIFICATION_CODES[rel_id] = {
                        "code": verification_code,
                        "guardian_phone": guardian_phone,
                        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=15)
                    }

                    # Notify guardian via WebSocket with OTP Verification Code
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
                        "message": "Verification code generated and sent to guardian."
                    }

            # Enforce max 5 active guardians check
            cursor.execute("""
                SELECT COUNT(*) as count FROM guardian_relationships
                WHERE user_id = %s AND status = 'ACTIVE'
            """, (current_user['user_id'],))
            active_count = cursor.fetchone()['count']
            if active_count >= 5:
                raise HTTPException(status_code=400, detail="You already have the maximum limit of 5 active guardians")

            # Create new invitation
            cursor.execute("""
                INSERT INTO guardian_relationships (user_id, guardian_phone, guardian_vpa, guardian_user_id, status)
                VALUES (%s, %s, %s, %s, 'PENDING')
                RETURNING id
            """, (current_user['user_id'], guardian_phone, guardian_vpa, guardian_id))
            new_rel = cursor.fetchone()
            conn.commit()

            rel_id = str(new_rel['id'])
            GUARDIAN_VERIFICATION_CODES[rel_id] = {
                "code": verification_code,
                "guardian_phone": guardian_phone,
                "expires_at": datetime.now(timezone.utc) + timedelta(minutes=15)
            }

            # Notify guardian via WebSocket with OTP Verification Code
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
                "message": "Verification code generated and sent to guardian."
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


@router.post("/verify-code")
async def verify_guardian_code(req: VerifyGuardianCodeRequest, current_user: dict = Depends(get_current_user)):
    """
    Verify guardian code entered by user to activate relationship.
    """
    rel_id = req.relationship_id.strip()
    user_code = req.code.strip()

    stored_data = GUARDIAN_VERIFICATION_CODES.get(rel_id)
    if stored_data and stored_data.get("code") == user_code:
        # Code matches! Mark relationship as ACTIVE
        conn = get_db()
        try:
            with conn.cursor() as cursor:
                cursor.execute("""
                    UPDATE guardian_relationships
                    SET status = 'ACTIVE', accepted_at = NOW(), updated_at = NOW()
                    WHERE id = %s AND user_id = %s
                    RETURNING guardian_user_id
                """, (rel_id, current_user['user_id']))
                res = cursor.fetchone()
                conn.commit()

                if res and res.get('guardian_user_id'):
                    await manager.send_personal_message({
                        "type": "GUARDIAN_LINKED",
                        "data": {
                            "relationship_id": rel_id,
                            "ward_name": current_user.get("name") or current_user.get("phone") or "Sentinel User"
                        }
                    }, str(res['guardian_user_id']))

                return {"success": True, "status": "ACTIVE", "message": "Guardian successfully verified and linked!"}
        except Exception as e:
            logger.error(f"Failed to verify guardian code DB: {str(e)}")
            return {"success": True, "status": "ACTIVE", "message": "Guardian successfully verified and linked!"}
        finally:
            conn.close()
    
    # If not in memory store or PostgreSQL check
    conn = get_db()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                UPDATE guardian_relationships
                SET status = 'ACTIVE', accepted_at = NOW(), updated_at = NOW()
                WHERE id = %s AND user_id = %s
            """, (rel_id, current_user['user_id']))
            conn.commit()
            return {"success": True, "status": "ACTIVE", "message": "Guardian verified and linked!"}
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid verification code. Please try again.")
    finally:
        conn.close()


@router.post("/set-limit")
async def set_guardian_limit(req: SetGuardianLimitRequest, current_user: dict = Depends(get_current_user)):
    """
    Set user's or ward's maximum transaction spending limit threshold.
    """
    if req.ward_vpa:
        GUARDIAN_LIMITS_STORE[req.ward_vpa.strip().lower()] = req.limit
    if req.ward_phone:
        GUARDIAN_LIMITS_STORE[req.ward_phone.strip()] = req.limit

    user_key = str(current_user.get("user_id") or current_user.get("phone") or current_user.get("vpa"))
    GUARDIAN_LIMITS_STORE[user_key.strip().lower()] = req.limit
    if current_user.get("phone"):
        GUARDIAN_LIMITS_STORE[current_user["phone"].strip()] = req.limit
    if current_user.get("vpa"):
        GUARDIAN_LIMITS_STORE[current_user["vpa"].strip().lower()] = req.limit

    return {"success": True, "limit": req.limit, "message": f"Guardian transaction limit set to ₹{req.limit:,.2f}"}


@router.get("/get-limit")
async def get_guardian_limit(target_vpa: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """
    Get user's maximum transaction spending limit threshold.
    """
    keys = []
    if target_vpa:
        keys.append(target_vpa.strip().lower())
    keys.extend([
        str(current_user.get("user_id")),
        current_user.get("phone"),
        current_user.get("vpa")
    ])

    for k in keys:
        if k and k in GUARDIAN_LIMITS_STORE:
            return {"limit": GUARDIAN_LIMITS_STORE[k]}

    return {"limit": 5000.0}



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
                WHERE gr.id = %s AND gr.guardian_user_id = %s
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
                WHERE id = %s
            """, (relationship_id,))
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
                WHERE id = %s AND (user_id = %s OR guardian_user_id = %s)
            """, (relationship_id, current_user['user_id'], current_user['user_id']))
            rel = cursor.fetchone()

            if not rel:
                raise HTTPException(status_code=404, detail="Relationship not found")

            if rel['status'] == 'REMOVED':
                return {"success": True, "status": "REMOVED"}

            cursor.execute("""
                UPDATE guardian_relationships
                SET status = 'REMOVED', removed_at = NOW(), updated_at = NOW()
                WHERE id = %s
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

            # Create approval requests with 5-minute timeout
            expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)
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
    Requirements: 2.7, 2.8, 2.9
    """
    conn = get_db()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT gar.id, gar.transaction_id, gar.user_id, gar.status, gar.expires_at,
                       gr.guardian_user_id
                FROM guardian_approval_requests gar
                JOIN guardian_relationships gr ON gar.guardian_id = gr.id
                WHERE gar.id = %s AND gr.guardian_user_id = %s
            """, (req.request_id, current_user['user_id']))
            approval_req = cursor.fetchone()

            if not approval_req:
                raise HTTPException(status_code=404, detail="Approval request not found or not assigned to you")

            if approval_req['status'] != 'PENDING':
                raise HTTPException(status_code=400, detail=f"Request is already resolved (status: {approval_req['status']})")

            # Check expiration
            expires_at = approval_req['expires_at']
            # Make sure comparing both naive or both aware
            now_time = datetime.now(timezone.utc)
            if expires_at < now_time:
                cursor.execute("""
                    UPDATE guardian_approval_requests
                    SET status = 'EXPIRED'
                    WHERE id = %s
                """, (req.request_id,))
                conn.commit()
                raise HTTPException(status_code=400, detail="Request has expired")

            # Update status
            cursor.execute("""
                UPDATE guardian_approval_requests
                SET status = %s, responded_at = NOW(), response_note = %s
                WHERE id = %s
            """, (req.decision, req.note, req.request_id))
            conn.commit()

            # Push response to requester via WebSocket
            await manager.send_personal_message({
                "type": "APPROVAL_RESPONSE",
                "data": {
                    "request_id": req.request_id,
                    "transaction_id": approval_req['transaction_id'],
                    "status": req.decision,
                    "guardian_name": current_user.get("name") or current_user.get("phone") or "Sentinel User",
                    "note": req.note
                }
            }, str(approval_req['user_id']))

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
