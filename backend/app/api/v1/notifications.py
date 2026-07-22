"""
Notifications API - Send SMS and push notifications for transactions
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional
from app.services.auth_service import verify_api_key
from app.services.sms_service import send_transaction_notification, extract_phone_from_vpa

logger = logging.getLogger("fraudshield.api.notifications")
router = APIRouter()


class TransactionNotificationRequest(BaseModel):
    """Request model for sending transaction notifications"""
    transaction_id: str
    sender_vpa: str
    receiver_vpa: str
    amount: float
    status: str  # APPROVED, REVIEW, REJECTED
    risk_score: float
    timestamp: str
    sender_phone: Optional[str] = None
    receiver_phone: Optional[str] = None


@router.post("/notifications/transaction", status_code=status.HTTP_200_OK)
async def send_transaction_sms(
    req: TransactionNotificationRequest,
    api_key: str = Depends(verify_api_key)
):
    """
    Send SMS notifications for a completed transaction.
    
    - Sends SMS to sender (always)
    - Sends SMS to receiver (only if APPROVED)
    """
    try:
        # Extract phone numbers if not provided
        sender_phone = req.sender_phone or extract_phone_from_vpa(req.sender_vpa)
        receiver_phone = req.receiver_phone or extract_phone_from_vpa(req.receiver_vpa)
        
        # Send notifications
        results = await send_transaction_notification(
            sender_phone=sender_phone,
            receiver_phone=receiver_phone,
            amount=req.amount,
            sender_vpa=req.sender_vpa,
            receiver_vpa=req.receiver_vpa,
            status=req.status,
            risk_score=req.risk_score,
            timestamp=req.timestamp,
            send_to_receiver=(req.status == "APPROVED"),
        )
        
        return {
            "success": True,
            "transaction_id": req.transaction_id,
            "notifications_sent": results,
        }
        
    except Exception as e:
        logger.error(f"Error sending transaction notification: {str(e)}", exc_info=True)
        # Don't fail the request - notifications are non-critical
        return {
            "success": False,
            "error": str(e),
            "transaction_id": req.transaction_id,
        }
