"""
SentinelPay AI — AI Scam Assistant Endpoints ("Is This Safe?")
"""
import re
from typing import List, Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.services.auth_service import verify_api_key

router = APIRouter()

class AssistantQueryRequest(BaseModel):
    query_text: str = Field(..., example="Someone calling from RBI asks me to transfer ₹5000 to verify account")

class AssistantQueryResponse(BaseModel):
    scam_probability: float
    threat_level: str # LOW, MEDIUM, HIGH, CRITICAL
    threat_category: str
    nl_explanation: str
    recommended_actions: List[str]
    detected_keywords: List[str]

SCAM_PATTERNS = [
    (r"\b(rbi|police|customs|cbi|ed|digital arrest)\b", "Digital Arrest Scam", 0.95, "CRITICAL"),
    (r"\b(telegram|part time|like youtube|10x|guaranteed return|crypto investment)\b", "Investment Scam", 0.92, "HIGH"),
    (r"\b(otp|one time password|share pin|cvv)\b", "OTP Scam", 0.90, "HIGH"),
    (r"\b(refund|electricity|bill unpaid|power disconnection)\b", "Fake Refund / Utility Scam", 0.85, "HIGH"),
    (r"\b(courier|fedex|dhl|parcel stuck|drugs found)\b", "Courier Scam", 0.94, "CRITICAL"),
    (r"\b(kyc|bank account blocked|update pan)\b", "Fake KYC Scam", 0.88, "HIGH"),
]

@router.post("/assistant/analyze", response_model=AssistantQueryResponse, dependencies=[Depends(verify_api_key)])
async def analyze_suspicious_query(payload: AssistantQueryRequest):
    text = payload.query_text.lower()
    
    detected_cat = "General Safety Advice"
    highest_prob = 0.15
    threat_level = "LOW"
    detected_kw = []

    for pattern, cat, prob, level in SCAM_PATTERNS:
        matches = re.findall(pattern, text)
        if matches:
            detected_cat = cat
            highest_prob = max(highest_prob, prob)
            threat_level = level
            detected_kw.extend(list(set(matches)))

    if highest_prob > 0.85:
        nl_exp = f"⚠️ HIGH RISK ALERT: This message contains classic patterns of a {detected_cat}. Scammers use urgency and authority to coerce payments."
        rec_actions = [
            "🚫 DO NOT send any money or share OTP / UPI PIN.",
            "📞 Hang up immediately if on a call with the suspicious party.",
            "🛡️ Report this VPA / Number via SentinelPay Community Reporting.",
        ]
    elif highest_prob > 0.50:
        nl_exp = f"⚠️ CAUTION: Potential {detected_cat} detected. Verify through official customer care channels."
        rec_actions = [
            "🔍 Verify the recipient VPA using SentinelPay QR Trust check.",
            "⚠️ Never enter your UPI PIN to receive money.",
        ]
    else:
        nl_exp = "✓ Low scam probability detected based on query analysis. Always ensure you know the recipient before confirming."
        rec_actions = [
            "✓ Proceed with caution and verify VPA name.",
        ]

    return AssistantQueryResponse(
        scam_probability=highest_prob,
        threat_level=threat_level,
        threat_category=detected_cat,
        nl_explanation=nl_exp,
        recommended_actions=rec_actions,
        detected_keywords=list(set(detected_kw)),
    )
