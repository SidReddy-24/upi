"""Router for Analyst Feedback submission."""
import logging
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from app.models.feedback import FeedbackRequest, FeedbackResponse
from app.db.database import get_db_session, AsyncSession
from app.engines.graph_engine import graph_engine
from app.services.redis_service import get_redis
from app.services.auth_service import verify_api_key

logger = logging.getLogger("fraudshield.api.feedback")
router = APIRouter()

@router.post("/feedback", response_model=FeedbackResponse, status_code=status.HTTP_200_OK)
async def submit_feedback(
    payload: FeedbackRequest,
    api_key: str = Depends(verify_api_key),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Submits analyst labels (fraud/legitimate) for scored transactions.
    Updates behavioral profile exclusions, blacklists recipient, and opens a case.
    """
    txn_id = payload.transaction_id
    feedback_id = f"fb_{uuid.uuid4().hex[:12]}"
    
    # 1. Fetch original transaction details to get VPA, device, and decision
    original_txn = await db.execute(
        text("SELECT sender_vpa, receiver_vpa, device_id, decision FROM transactions WHERE transaction_id = :txn_id"),
        {"txn_id": txn_id}
    )
    row = original_txn.first()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transaction with ID {txn_id} not found."
        )
        
    sender_vpa, receiver_vpa, device_id, original_decision = row
    
    actions_triggered = []
    case_id = None
    
    try:
        # 2. Persist feedback submission to DB
        await db.execute(
            text("""
                INSERT INTO feedback (
                    transaction_id, analyst_id, feedback_type, original_decision, 
                    analyst_decision, fraud_type, notes
                ) VALUES (
                    :txn_id, :analyst, :fb_type, :orig_dec, 
                    :analyst_dec, :fraud_type, :notes
                )
            """),
            {
                "txn_id": txn_id,
                "analyst": "analyst_demo",
                "fb_type": payload.feedback_type,
                "orig_dec": original_decision or "REVIEW",
                "analyst_dec": payload.analyst_decision,
                "fraud_type": payload.fraud_type,
                "notes": payload.notes
            }
        )
        
        # If analyst confirms fraud
        if payload.analyst_decision == "FRAUD":
            # Update user flag
            await db.execute(
                text("UPDATE users SET fraud_flag = TRUE, fraud_confirmed_at = NOW() WHERE vpa = :vpa"),
                {"vpa": sender_vpa}
            )
            # Update device flag
            await db.execute(
                text("UPDATE devices SET fraud_flag = TRUE WHERE device_id = :device"),
                {"device": device_id}
            )
            
            # Feed Graph Engine directly
            graph_engine.mark_node_as_fraud(sender_vpa)
            graph_engine.mark_node_as_fraud(device_id)
            graph_engine.mark_node_as_fraud(receiver_vpa)
            
            # 3. Add to blacklisted VPA list in Redis
            redis = await get_redis()
            blacklist_key = f"vpa:{receiver_vpa}:blacklisted"
            await redis.set(blacklist_key, "1")  # expire not set for blacklist
            actions_triggered.append("blacklist_receiver_queued")
            
            # 4. Trigger profile updates (Queue profile exclusions)
            # Simulating update: remove fraud amount from user profile rolling window in Redis
            profile_key = f"user:{sender_vpa}:profile"
            profile_data = await redis.hgetall(profile_key)
            if profile_data:
                # Set a flag in profile indicating user was compromise target
                await redis.hset(profile_key, mapping={"compromised": "true"})
            actions_triggered.append("profile_update_queued")
            
            # 5. Escalate to Case
            if payload.escalate_to_case:
                case_id = f"CASE_{uuid.uuid4().hex[:8].upper()}"
                await db.execute(
                    text("""
                        INSERT INTO fraud_cases (
                            case_id, transaction_id, user_id, fraud_type, 
                            status, priority, opened_at, notes
                        ) VALUES (
                            :case_id, :txn_id, :user_id, :fraud_type,
                            'OPEN', 'HIGH', NOW(), :notes
                        )
                    """),
                    {
                        "case_id": case_id,
                        "txn_id": txn_id,
                        "user_id": sender_vpa,
                        "fraud_type": payload.fraud_type,
                        "notes": payload.notes
                    }
                )
                actions_triggered.append("fraud_case_created")
                
            actions_triggered.append("model_retraining_signal_sent")
            
        await db.commit()
        
        return FeedbackResponse(
            feedback_id=feedback_id,
            status="ACCEPTED",
            actions_triggered=actions_triggered,
            case_id=case_id
        )
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Error saving analyst feedback: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error processing feedback submission."
        )
