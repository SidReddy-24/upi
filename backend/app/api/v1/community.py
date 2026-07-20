"""
SentinelPay AI — Community Trust & Scam Passport Endpoints
"""
import uuid
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from app.services.auth_service import verify_api_key

router = APIRouter()

# ─── In-Memory Store for Demo Reports & Passports ──────────────────────────

REPORTS_DB = []
PASSPORTS_DB = {
    "mule@okhdfc": {
        "entity_id": "mule@okhdfc",
        "entity_type": "VPA",
        "trust_score": 5,
        "trust_level": "High Risk",
        "credibility_score": 12,
        "complaint_count": 14,
        "verified_complaints": 12,
        "categories": ["Mule Account", "Fake Refund", "Investment Scam"],
        "known_to_user": False,
        "platform_age_days": 18,
        "linked_entities": ["9876543210", "DEV_SUSPICIOUS_99"],
    },
    "merchant@okaxis": {
        "entity_id": "merchant@okaxis",
        "entity_type": "VPA",
        "trust_score": 96,
        "trust_level": "Verified Safe",
        "credibility_score": 98,
        "complaint_count": 0,
        "verified_complaints": 0,
        "categories": [],
        "known_to_user": True,
        "platform_age_days": 420,
        "linked_entities": ["Axis Retail Pvt Ltd"],
    }
}

# ─── Schemas ─────────────────────────────────────────────────────────────────

class ReportRequest(BaseModel):
    entity_id: str = Field(..., example="scammer@okicici")
    entity_type: str = Field("VPA", example="VPA") # VPA, PHONE, QR, URL
    category: str = Field(..., example="Investment Scam")
    description: str = Field(..., example="Promised 10x returns on telegram channel")
    reporter_vpa: Optional[str] = Field("demo@sentinelpay", example="demo@sentinelpay")

class ReportResponse(BaseModel):
    report_id: str
    entity_id: str
    status: str
    updated_trust_score: int
    message: str

class ScamPassportResponse(BaseModel):
    entity_id: str
    entity_type: str
    trust_score: int
    trust_level: str
    credibility_score: int
    complaint_count: int
    verified_complaints: int
    categories: List[str]
    known_to_user: bool
    platform_age_days: int
    linked_entities: List[str]

# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.post("/community/report", response_model=ReportResponse, dependencies=[Depends(verify_api_key)])
async def submit_scam_report(payload: ReportRequest):
    """
    Submits a community scam report for a VPA, phone number, or QR code.
    Calculates evidence impact and updates the entity's trust score.
    """
    report_id = f"REP_{uuid.uuid4().hex[:8].upper()}"
    REPORTS_DB.append({
        "report_id": report_id,
        "entity_id": payload.entity_id,
        "entity_type": payload.entity_type,
        "category": payload.category,
        "description": payload.description,
        "reporter": payload.reporter_vpa,
    })

    # Update or initialize passport
    entity = payload.entity_id
    if entity not in PASSPORTS_DB:
        PASSPORTS_DB[entity] = {
            "entity_id": entity,
            "entity_type": payload.entity_type,
            "trust_score": 75,
            "trust_level": "Normal",
            "credibility_score": 70,
            "complaint_count": 0,
            "verified_complaints": 0,
            "categories": [],
            "known_to_user": False,
            "platform_age_days": 15,
            "linked_entities": [],
        }

    passport = PASSPORTS_DB[entity]
    passport["complaint_count"] += 1
    passport["verified_complaints"] += 1
    if payload.category not in passport["categories"]:
        passport["categories"].append(payload.category)
    
    # Penalize trust score based on report
    passport["trust_score"] = max(0, passport["trust_score"] - 25)
    passport["credibility_score"] = max(0, passport["credibility_score"] - 20)
    
    if passport["trust_score"] < 20:
        passport["trust_level"] = "High Risk"
    elif passport["trust_score"] < 50:
        passport["trust_level"] = "Community Flagged"
    elif passport["trust_score"] < 75:
        passport["trust_level"] = "Watchlist"

    return ReportResponse(
        report_id=report_id,
        entity_id=payload.entity_id,
        status="ACCEPTED",
        updated_trust_score=passport["trust_score"],
        message=f"Scam report filed successfully for {payload.entity_id}. Entity trust score updated."
    )

@router.get("/passport/{entity_id}", response_model=ScamPassportResponse, dependencies=[Depends(verify_api_key)])
async def get_scam_passport(entity_id: str):
    """
    Retrieves the Scam Passport & Credibility Score for a given entity.
    """
    if entity_id in PASSPORTS_DB:
        return ScamPassportResponse(**PASSPORTS_DB[entity_id])
    
    # Default passport for unflagged/new entities
    return ScamPassportResponse(
        entity_id=entity_id,
        entity_type="VPA" if "@" in entity_id else "PHONE",
        trust_score=85,
        trust_level="Normal",
        credibility_score=80,
        complaint_count=0,
        verified_complaints=0,
        categories=[],
        known_to_user=False,
        platform_age_days=60,
        linked_entities=[],
    )
