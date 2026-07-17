"""Pydantic schemas for Analyst Feedback submission."""
from pydantic import BaseModel, Field
from typing import List, Optional


class FeedbackRequest(BaseModel):
    transaction_id: str = Field(..., description="Unique transaction ID being labeled")
    feedback_type: str = Field(..., description="CONFIRM_FRAUD, CLEAR_FRAUD, ESCALATE")
    analyst_decision: str = Field(..., description="FRAUD, LEGITIMATE, INCONCLUSIVE")
    fraud_type: Optional[str] = Field(None, description="e.g. ACCOUNT_TAKEOVER, SYNTHETIC_ID, MONEY_MULE")
    notes: Optional[str] = Field(None, description="Detailed notes on analyst's investigation")
    escalate_to_case: Optional[bool] = Field(False, description="Whether to open a fraud case")


class FeedbackResponse(BaseModel):
    feedback_id: str = Field(..., description="Unique identifier for the feedback submission")
    status: str = Field("ACCEPTED", description="Status of submission processing")
    actions_triggered: List[str] = Field(default_factory=list, description="Automated actions kicked off by feedback")
    case_id: Optional[str] = Field(None, description="Case ID generated if escalated")
