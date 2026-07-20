"""Router for Transaction Risk Query endpoint."""
import json
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from app.db.database import get_db_session, AsyncSession
from app.services.auth_service import verify_api_key

logger = logging.getLogger("fraudshield.api.risk")
router = APIRouter()

@router.get("/risk/{transaction_id}", status_code=status.HTTP_200_OK)
async def get_risk_details(
    transaction_id: str,
    api_key: str = Depends(verify_api_key),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Returns full scoring result, signals, SHAP logs, and audit logs for a transaction.
    Based on SRD Section 15.3.
    """
    try:
        # Fetch transaction detail
        txn_res = await db.execute(
            text("""
                SELECT transaction_id, sender_vpa, receiver_vpa, amount, currency, 
                       txn_type, device_id, ip_address, geo_lat, geo_lon, 
                       risk_score, confidence, decision, model_version, latency_ms, created_at, status
                FROM transactions 
                WHERE transaction_id = :txn_id
            """),
            {"txn_id": transaction_id}
        )
        txn_row = txn_res.first()
        
        if not txn_row:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Transaction {transaction_id} not found."
            )
            
        # Fetch risk scores detail
        score_res = await db.execute(
            text("""
                SELECT ml_score, iso_score, rule_risk, behavioral_score, graph_risk, 
                       composite_risk, confidence, rule_flags, shap_values, reasons, nl_summary, model_version
                FROM risk_scores 
                WHERE transaction_id = :txn_id
            """),
            {"txn_id": transaction_id}
        )
        score_row = score_res.first()
        
        # Assemble scoring details
        scoring_details = {}
        if score_row:
            try:
                rule_flags_list = json.loads(score_row[7]) if isinstance(score_row[7], str) else (score_row[7] or [])
            except Exception:
                rule_flags_list = []
                
            try:
                shap_dict = json.loads(score_row[8]) if isinstance(score_row[8], str) else (score_row[8] or {})
            except Exception:
                shap_dict = {}
                
            try:
                reasons_list = json.loads(score_row[9]) if isinstance(score_row[9], str) else (score_row[9] or [])
            except Exception:
                reasons_list = []
                
            scoring_details = {
                "nl_summary": score_row[10],
                "reasons": reasons_list,
                "top_features": [{"feature": k, "value": 0, "contribution": v, "direction": "INCREASES_RISK"} for k, v in shap_dict.items()],
                "model_version": score_row[11]
            }

        # Fetch case if escalated
        case_res = await db.execute(
            text("SELECT case_id, status, priority FROM fraud_cases WHERE transaction_id = :txn_id"),
            {"txn_id": transaction_id}
        )
        case_row = case_res.first()
        case_id = case_row[0] if case_row else None
        feedback_status = "CONFIRMED_FRAUD" if case_row and case_row[1] == "CONFIRMED" else ("OPEN_CASE" if case_row else "LEGITIMATE")

        # Compile audit trail
        audit_trail = [
            {
                "event": "SCORED",
                "timestamp": txn_row[15].isoformat() if txn_row[15] else None,
                "actor": "system",
                "detail": f"Automated scoring: {txn_row[12]} ({float(txn_row[10] or 0.0):.0%})"
            }
        ]
        
        # Add feedback entry in audit trail if feedback submitted
        fb_res = await db.execute(
            text("SELECT submitted_at, analyst_id, feedback_type, notes FROM feedback WHERE transaction_id = :txn_id"),
            {"txn_id": transaction_id}
        )
        fb_row = fb_res.first()
        if fb_row:
            audit_trail.append({
                "event": "REVIEWED",
                "timestamp": fb_row[0].isoformat() if fb_row[0] else None,
                "actor": fb_row[1],
                "detail": f"Confirmed fraud: {fb_row[2]}. Notes: {fb_row[3]}"
            })

        return {
            "transaction_id": transaction_id,
            "sender_vpa": txn_row[1],
            "receiver_vpa": txn_row[2],
            "amount": float(txn_row[3]),
            "currency": txn_row[4],
            "txn_type": txn_row[5],
            "device_id": txn_row[6],
            "ip_address": txn_row[7],
            "geo_lat": float(txn_row[8]) if txn_row[8] else None,
            "geo_lon": float(txn_row[9]) if txn_row[9] else None,
            "risk_score": float(txn_row[10] or 0.0),
            "confidence": float(txn_row[11] or 0.0),
            "decision": txn_row[12],
            "latency_ms": txn_row[14],
            "created_at": txn_row[15].isoformat() if txn_row[15] else None,
            "scoring_result": {
                "risk_score": float(txn_row[10] or 0.0),
                "confidence": float(txn_row[11] or 0.0),
                "decision": txn_row[12],
                "explanation": scoring_details,
                "signals": {
                    "rule_flags": rule_flags_list,
                    "behavioral_deviation": float(score_row[3]) if score_row else 0.0,
                    "graph_risk": float(score_row[4]) if score_row else 0.0,
                    "device_risk": 0.0
                }
            },
            "feedback_status": feedback_status,
            "case_id": case_id,
            "audit_trail": audit_trail
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying risk details: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database lookup error."
        )
