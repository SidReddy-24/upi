"""Pydantic schemas for Fraud Scoring Results."""
from datetime import datetime
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any


class FeatureContribution(BaseModel):
    feature: str = Field(..., description="Feature name")
    value: Any = Field(..., description="Actual feature value during evaluation")
    contribution: float = Field(..., description="SHAP contribution value")
    direction: str = Field(..., description="INCREASES_RISK or DECREASES_RISK")


class ReasonCode(BaseModel):
    code: str = Field(..., description="Reason code identifier, e.g., HIGH_VELOCITY")
    description: str = Field(..., description="User-friendly explanation of why it increased risk")
    severity: str = Field(..., description="CRITICAL, HIGH, MEDIUM, LOW")
    contribution: Optional[float] = Field(None, description="SHAP contribution if applicable")


class Explanation(BaseModel):
    nl_summary: str = Field(..., description="Natural language plain English summary explaining the decision")
    reasons: List[ReasonCode] = Field(default_factory=list, description="Top reasons driving the score")
    top_features: List[FeatureContribution] = Field(default_factory=list, description="Raw feature contributions")
    model_version: str = Field(..., description="Version of the inference model used")


class Signals(BaseModel):
    rule_flags: List[str] = Field(default_factory=list, description="Triggered rule identifiers")
    behavioral_deviation: float = Field(..., description="Behavior deviation score [0, 1]")
    graph_risk: float = Field(..., description="Graph network risk score [0, 1]")
    device_risk: float = Field(..., description="Device intelligence risk score [0, 1]")


class ScoringResponse(BaseModel):
    request_id: str = Field(..., description="UUID of scoring request")
    transaction_id: str = Field(..., description="Unique transaction ID scored")
    scored_at: datetime = Field(..., description="ISO timestamp when transaction was scored")
    latency_ms: int = Field(..., description="Time taken to score in milliseconds")
    risk_score: float = Field(..., description="Composite risk score between 0.0 and 1.0")
    confidence: float = Field(..., description="Confidence score of decision between 0.0 and 1.0")
    decision: str = Field(..., description="APPROVE, REVIEW, or REJECT")
    explanation: Explanation
    signals: Signals
