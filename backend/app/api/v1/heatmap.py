"""
SentinelPay AI — Scam Heat Map & Threat Trends Endpoints
"""
from typing import List
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.services.auth_service import verify_api_key

router = APIRouter()

class CityFraudStats(BaseModel):
    city: str
    state: str
    risk_level: str # HIGH, MEDIUM, LOW
    active_cases: int
    top_scam_type: str
    fraud_trend_pct: float

class HeatMapResponse(BaseModel):
    total_active_hotspots: int
    national_fraud_wave_alert: bool
    hotspots: List[CityFraudStats]

@router.get("/heatmap", response_model=HeatMapResponse, dependencies=[Depends(verify_api_key)])
async def get_scam_heatmap():
    return HeatMapResponse(
        total_active_hotspots=4,
        national_fraud_wave_alert=True,
        hotspots=[
            CityFraudStats(city="Jamtara", state="Jharkhand", risk_level="CRITICAL", active_cases=342, top_scam_type="Fake KYC / Banking", fraud_trend_pct=14.2),
            CityFraudStats(city="Nuh / Mewat", state="Haryana", risk_level="HIGH", active_cases=219, top_scam_type="Digital Arrest Scam", fraud_trend_pct=8.5),
            CityFraudStats(city="Bengaluru", state="Karnataka", risk_level="MEDIUM", active_cases=184, top_scam_type="Investment / Telegram", fraud_trend_pct=-3.1),
            CityFraudStats(city="Delhi NCR", state="Delhi", risk_level="HIGH", active_cases=290, top_scam_type="Courier / Drugs Scam", fraud_trend_pct=11.0),
        ]
    )
