"""Router for Transaction Scoring API endpoint."""
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from app.models.transaction import TransactionRequest
from app.models.scoring_result import ScoringResponse
from app.core.scoring_engine import score_transaction
from app.services.auth_service import verify_api_key

logger = logging.getLogger("fraudshield.api.score")
router = APIRouter()

@router.post("/score", response_model=ScoringResponse, status_code=status.HTTP_200_OK)
async def score(
    txn: TransactionRequest,
    api_key: str = Depends(verify_api_key)
):
    """
    Submit a UPI transaction to be evaluated for fraud risk in real-time.
    Returns composite score, decision, explanation, and signals.
    """
    try:
        response = await score_transaction(txn)
        return response
    except Exception as e:
        logger.error(f"Uncaught scoring exception: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal scoring error: {str(e)}"
        )
