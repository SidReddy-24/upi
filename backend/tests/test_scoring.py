"""Integration tests for FastAPI scoring and feedback endpoints."""
import pytest
import httpx
from datetime import datetime

BASE_URL = "http://localhost:8000/api/v1"
HEADERS = {"X-API-Key": "fs_demo_key_001", "Content-Type": "application/json"}

@pytest.mark.asyncio
async def test_health_endpoint():
    """Verify health status returns UP for backend services."""
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{BASE_URL}/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] in ["HEALTHY", "DEGRADED"]
        assert "components" in data

@pytest.mark.asyncio
async def test_scoring_endpoint_approve():
    """Verify scoring logic approves a standard legitimate transaction."""
    payload = {
        "transaction_id": "TXN_TEST_LEGIT_001",
        "sender_vpa": "rahul.sharma@upi",
        "receiver_vpa": "grocerystore@paytm",
        "amount": 1500.00,
        "currency": "INR",
        "transaction_type": "P2M",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "device": {
            "device_id": "trusted_device_001",
            "os_type": "ANDROID",
            "os_version": "14",
            "app_version": "5.2.1",
            "is_rooted": False,
            "is_emulator": False
        },
        "location": {
            "latitude": 12.9716,
            "longitude": 77.5946
        },
        "metadata": {
            "org_id": "hdfc_bank"
        }
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(f"{BASE_URL}/score", json=payload, headers=HEADERS)
        assert response.status_code == 200
        data = response.json()
        assert data["decision"] == "APPROVE"
        assert data["risk_score"] < 0.35
        assert "explanation" in data

@pytest.mark.asyncio
async def test_scoring_endpoint_reject_blacklist():
    """Verify receiver blacklist immediately triggers critical rule rejection."""
    payload = {
        "transaction_id": "TXN_TEST_BLACK_002",
        "sender_vpa": "rahul.sharma@upi",
        "receiver_vpa": "mule_account@upi",
        "amount": 25000.00,
        "currency": "INR",
        "transaction_type": "P2P",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "device": {
            "device_id": "trusted_device_001",
            "os_type": "ANDROID"
        },
        "metadata": {
            "org_id": "hdfc_bank"
        }
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(f"{BASE_URL}/score", json=payload, headers=HEADERS)
        assert response.status_code == 200
        data = response.json()
        assert data["decision"] == "REJECT"
        assert "R001" in data["signals"]["rule_flags"]
        assert "blacklist" in data["explanation"]["nl_summary"].lower()
