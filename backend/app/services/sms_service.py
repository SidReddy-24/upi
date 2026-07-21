"""
SMS Notification Service

Sends transaction notifications via SMS using:
- Twilio (production)
- Mock/console (development)
- On-device SMS (Android native - future)
"""
import os
import logging
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)

# Configuration
TWILIO_ENABLED = os.getenv("TWILIO_ENABLED", "false").lower() == "true"
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_FROM_NUMBER = os.getenv("TWILIO_FROM_NUMBER", "")

# Import Twilio only if enabled
if TWILIO_ENABLED:
    try:
        from twilio.rest import Client
        twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    except ImportError:
        logger.warning("Twilio library not installed. Install with: pip install twilio")
        TWILIO_ENABLED = False
        twilio_client = None
else:
    twilio_client = None


def format_transaction_sms(
    amount: float,
    vpa: str,
    status: str,
    risk_score: float,
    timestamp: str,
    is_sender: bool = True,
) -> str:
    """
    Format SMS message for transaction notification.
    
    Args:
        amount: Transaction amount
        vpa: Counterparty VPA
        status: APPROVED, REVIEW, or REJECTED
        risk_score: Fraud risk score (0-1)
        timestamp: Transaction timestamp
        is_sender: True if this SMS is for sender, False for receiver
    
    Returns:
        Formatted SMS message (max 160 chars for single SMS)
    """
    # Format amount
    amt_str = f"₹{amount:,.0f}"
    
    # Format timestamp (DD MMM, HH:MM)
    try:
        dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
        time_str = dt.strftime("%d %b, %H:%M")
    except:
        time_str = "now"
    
    # Format risk score as percentage
    risk_pct = int(risk_score * 100)
    
    # Build message based on role
    direction = "sent to" if is_sender else "received from"
    
    # Keep it under 160 characters
    if status == "APPROVED":
        msg = f"SentinelPay: {amt_str} {direction} {vpa}. ✓ Approved. {time_str}"
    elif status == "REVIEW":
        msg = f"SentinelPay: {amt_str} {direction} {vpa}. ⚠ Flagged (Risk:{risk_pct}%). {time_str}"
    else:  # REJECTED
        msg = f"SentinelPay: {amt_str} to {vpa}. ✗ Blocked (Risk:{risk_pct}%). {time_str}"
    
    return msg


async def send_sms_twilio(to_phone: str, message: str) -> bool:
    """
    Send SMS via Twilio.
    
    Args:
        to_phone: Recipient phone number (E.164 format, e.g., +919876543210)
        message: SMS message text
    
    Returns:
        True if sent successfully, False otherwise
    """
    if not TWILIO_ENABLED or not twilio_client:
        logger.warning(f"Twilio not enabled. Would send to {to_phone}: {message}")
        return False
    
    try:
        msg = twilio_client.messages.create(
            body=message,
            from_=TWILIO_FROM_NUMBER,
            to=to_phone
        )
        logger.info(f"SMS sent to {to_phone}. SID: {msg.sid}")
        return True
    except Exception as e:
        logger.error(f"Failed to send SMS to {to_phone}: {str(e)}")
        return False


async def send_transaction_notification(
    sender_phone: Optional[str],
    receiver_phone: Optional[str],
    amount: float,
    sender_vpa: str,
    receiver_vpa: str,
    status: str,
    risk_score: float,
    timestamp: str,
    send_to_receiver: bool = True,
) -> dict:
    """
    Send transaction notification SMS to sender and optionally receiver.
    
    Args:
        sender_phone: Sender's phone number
        receiver_phone: Receiver's phone number
        amount: Transaction amount
        sender_vpa: Sender VPA
        receiver_vpa: Receiver VPA
        status: Transaction status (APPROVED, REVIEW, REJECTED)
        risk_score: Fraud risk score
        timestamp: Transaction timestamp
        send_to_receiver: Whether to send SMS to receiver (only for APPROVED)
    
    Returns:
        dict with status of SMS delivery
    """
    results = {
        "sender_sms_sent": False,
        "receiver_sms_sent": False,
        "sender_message": None,
        "receiver_message": None,
    }
    
    # Send to sender (always)
    if sender_phone:
        sender_msg = format_transaction_sms(
            amount=amount,
            vpa=receiver_vpa,
            status=status,
            risk_score=risk_score,
            timestamp=timestamp,
            is_sender=True,
        )
        results["sender_message"] = sender_msg
        
        if TWILIO_ENABLED:
            results["sender_sms_sent"] = await send_sms_twilio(sender_phone, sender_msg)
        else:
            # Mock mode - just log
            logger.info(f"[MOCK SMS] To {sender_phone}: {sender_msg}")
            results["sender_sms_sent"] = True  # Mark as "sent" in mock mode
    
    # Send to receiver (only if APPROVED and phone provided)
    if send_to_receiver and receiver_phone and status == "APPROVED":
        receiver_msg = format_transaction_sms(
            amount=amount,
            vpa=sender_vpa,
            status=status,
            risk_score=risk_score,
            timestamp=timestamp,
            is_sender=False,
        )
        results["receiver_message"] = receiver_msg
        
        if TWILIO_ENABLED:
            results["receiver_sms_sent"] = await send_sms_twilio(receiver_phone, receiver_msg)
        else:
            # Mock mode - just log
            logger.info(f"[MOCK SMS] To {receiver_phone}: {receiver_msg}")
            results["receiver_sms_sent"] = True  # Mark as "sent" in mock mode
    
    return results


# Utility function to extract phone from VPA
def extract_phone_from_vpa(vpa: str) -> Optional[str]:
    """
    Extract phone number from VPA if it's phone-based (e.g., 9876543210@paytm).
    Otherwise return None.
    
    For demo purposes, we'll use mock phone numbers.
    In production, you'd look up phone in user database.
    """
    # For demo: return mock phone number based on VPA
    # In production: query database for user's registered phone
    vpa_to_phone = {
        "alice@okaxis": "+919876543210",
        "bob@oksbi": "+919876543211",
        "merchant@okaxis": "+919876543212",
        "user@okhdfc": "+919876543213",
    }
    return vpa_to_phone.get(vpa)
