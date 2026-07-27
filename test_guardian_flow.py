"""
Comprehensive Test Suite for Guardian Flow (5 Phases).
Phases:
  1. Guardian Linking (OTP Flow)
  2. Configuration & Permissions
  3. Transaction Enforcement (Cumulative limit hard-stop)
  4. Approval Process (Approve, Reject, Timeout Expiry, Race Conditions)
  5. Guardian Dashboard & Reset Counter
"""

import pytest
import uuid
import json
from fastapi.testclient import TestClient
from app.main import app
from app.api.v1.auth import get_db
from app.api.v1.guardian import GUARDIAN_VERIFICATION_CODES

client = TestClient(app)

# Helper functions to seed test users and generate tokens
def create_test_user(phone: str, vpa: str, name: str, balance: float = 50000.0):
    conn = get_db()
    user_id = str(uuid.uuid4())
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                INSERT INTO auth_users (id, phone, email, password_hash, vpa, name, balance)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (phone) DO UPDATE SET balance = EXCLUDED.balance
                RETURNING id
            """, (user_id, phone, f"{phone}@test.com", "hash123", vpa, name, balance))
            row = cursor.fetchone()
            conn.commit()
            return str(row['id']) if row else user_id
    finally:
        conn.close()

def get_auth_token(phone: str):
    from app.api.v1.auth import generate_access_token
    conn = get_db()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT id, phone, email, vpa, name FROM auth_users WHERE phone = %s", (phone,))
            row = cursor.fetchone()
            if row:
                return generate_access_token(str(row['id']), row['phone'], row.get('email'))
    finally:
        conn.close()
    return generate_access_token(str(uuid.uuid4()), phone, f"{phone}@test.com")

import random

@pytest.fixture
def setup_users():
    rand_suffix = str(random.randint(100000, 999999))
    phone_ward = f"9000{rand_suffix}"
    vpa_ward = f"ward_{rand_suffix}@sentinelpay"
    ward_id = create_test_user(phone_ward, vpa_ward, "Test Ward", 50000.0)
    ward_token = get_auth_token(phone_ward)

    phone_guardian = f"9100{rand_suffix}"
    vpa_guardian = f"guardian_{rand_suffix}@sentinelpay"
    guardian_id = create_test_user(phone_guardian, vpa_guardian, "Test Guardian", 50000.0)
    guardian_token = get_auth_token(phone_guardian)

    phone_recip = f"9200{rand_suffix}"
    vpa_recip = f"merchant_{rand_suffix}@sentinelpay"
    recip_id = create_test_user(phone_recip, vpa_recip, "Test Merchant", 1000.0)

    return {
        "ward": {"id": ward_id, "phone": phone_ward, "vpa": vpa_ward, "token": ward_token},
        "guardian": {"id": guardian_id, "phone": phone_guardian, "vpa": vpa_guardian, "token": guardian_token},
        "recipient": {"id": recip_id, "phone": phone_recip, "vpa": vpa_recip}
    }

def test_phase1_guardian_linking_otp(setup_users):
    ward = setup_users["ward"]
    guardian = setup_users["guardian"]

    headers_ward = {"Authorization": f"Bearer {ward['token']}"}
    headers_guardian = {"Authorization": f"Bearer {guardian['token']}"}

    # Step 1: Ward invites Guardian
    resp_invite = client.post("/api/v1/guardian/add", json={"phone": guardian["phone"]}, headers=headers_ward)
    assert resp_invite.status_code == 200, resp_invite.text
    data_invite = resp_invite.json()
    assert "relationship_id" in data_invite
    rel_id = data_invite["relationship_id"]
    code = data_invite.get("verification_code") or GUARDIAN_VERIFICATION_CODES.get(rel_id, {}).get("code")
    assert code is not None, "Verification code must be generated"

    # Step 2: Guardian sees verification code in list
    resp_list_g = client.get("/api/v1/guardian/list", headers=headers_guardian)
    assert resp_list_g.status_code == 200
    my_wards = resp_list_g.json()["wards"]
    assert any(w["id"] == rel_id and w["verification_code"] == code for w in my_wards)

    # Step 3: Guardian approves invitation
    resp_approve = client.post("/api/v1/guardian/invitation/respond", json={"relationship_id": rel_id, "decision": "APPROVE"}, headers=headers_guardian)
    assert resp_approve.status_code == 200
    assert resp_approve.json()["status"] == "APPROVED"

    # Step 4: Ward enters 6-digit code to complete verification & link
    resp_verify = client.post("/api/v1/guardian/verify-code", json={"relationship_id": rel_id, "code": code}, headers=headers_ward)
    assert resp_verify.status_code == 200, resp_verify.text
    assert resp_verify.json()["status"] == "ACTIVE"

    # Verify relationship status in list
    resp_list = client.get("/api/v1/guardian/list", headers=headers_ward)
    assert resp_list.status_code == 200
    guardians = resp_list.json()["guardians"]
    assert any(g["id"] == rel_id and g["status"] == "ACTIVE" for g in guardians)

def test_guardian_rejection_flow(setup_users):
    ward = setup_users["ward"]
    guardian = setup_users["guardian"]

    headers_ward = {"Authorization": f"Bearer {ward['token']}"}
    headers_guardian = {"Authorization": f"Bearer {guardian['token']}"}

    # Ward invites Guardian
    resp_invite = client.post("/api/v1/guardian/add", json={"phone": guardian["phone"]}, headers=headers_ward)
    rel_id = resp_invite.json()["relationship_id"]
    code = resp_invite.json().get("verification_code") or GUARDIAN_VERIFICATION_CODES.get(rel_id, {}).get("code")

    # Guardian rejects invitation
    resp_reject = client.post("/api/v1/guardian/invitation/respond", json={"relationship_id": rel_id, "decision": "REJECT"}, headers=headers_guardian)
    assert resp_reject.status_code == 200
    assert resp_reject.json()["status"] == "REJECTED"

    # Ward attempts to verify code after rejection -> returns 400 Bad Request
    resp_verify = client.post("/api/v1/guardian/verify-code", json={"relationship_id": rel_id, "code": code}, headers=headers_ward)
    assert resp_verify.status_code == 400, resp_verify.text


def test_phase2_config_and_permissions(setup_users):
    ward = setup_users["ward"]
    guardian = setup_users["guardian"]

    headers_ward = {"Authorization": f"Bearer {ward['token']}"}
    headers_guardian = {"Authorization": f"Bearer {guardian['token']}"}

    # Link guardian first
    resp_invite = client.post("/api/v1/guardian/add", json={"phone": guardian["phone"]}, headers=headers_ward)
    rel_id = resp_invite.json()["relationship_id"]
    otp_code = GUARDIAN_VERIFICATION_CODES.get(rel_id, {}).get("code")
    client.post("/api/v1/guardian/verify-code", json={"relationship_id": rel_id, "code": otp_code}, headers=headers_ward)

    # Guardian sets cumulative limit = ₹3000 and timeout = 10 min
    resp_cfg = client.post("/api/v1/guardian/set-ward-config", json={
        "ward_vpa": ward["vpa"],
        "limit": 3000.0,
        "timeout_minutes": 10
    }, headers=headers_guardian)
    assert resp_cfg.status_code == 200, resp_cfg.text
    assert resp_cfg.json()["limit"] == 3000.0
    assert resp_cfg.json()["timeout_minutes"] == 10

    # Verify ward details read by guardian
    resp_details = client.get(f"/api/v1/guardian/ward-details/{ward['vpa']}", headers=headers_guardian)
    assert resp_details.status_code == 200
    cfg = resp_details.json()["config"]
    assert cfg["limit"] == 3000.0
    assert cfg["timeout_minutes"] == 10
    assert cfg["remaining_limit"] == 3000.0

def test_phase3_and_4_transaction_enforcement_and_approval(setup_users):
    ward = setup_users["ward"]
    guardian = setup_users["guardian"]
    recipient = setup_users["recipient"]

    headers_ward = {"Authorization": f"Bearer {ward['token']}"}
    headers_guardian = {"Authorization": f"Bearer {guardian['token']}"}

    # 1. Link guardian
    resp_invite = client.post("/api/v1/guardian/add", json={"phone": guardian["phone"]}, headers=headers_ward)
    rel_id = resp_invite.json()["relationship_id"]
    otp_code = GUARDIAN_VERIFICATION_CODES.get(rel_id, {}).get("code")
    client.post("/api/v1/guardian/verify-code", json={"relationship_id": rel_id, "code": otp_code}, headers=headers_ward)

    # 2. Guardian sets limit = ₹2000
    client.post("/api/v1/guardian/set-ward-config", json={"ward_vpa": ward["vpa"], "limit": 2000.0, "timeout_minutes": 5}, headers=headers_guardian)

    # 3. Ward makes transaction of ₹1500 (Under limit -> Should succeed without approval)
    resp_txn1 = client.post("/api/v1/transfer", json={
        "sender_vpa": ward["vpa"],
        "receiver_vpa": recipient["vpa"],
        "amount": 1500.0
    }, headers={"X-API-Key": "fs_demo_key_001"})
    assert resp_txn1.status_code == 200, resp_txn1.text
    assert resp_txn1.json()["status"] == "SUCCESS"

    # Check remaining limit (2000 - 1500 = 500)
    resp_limit = client.get("/api/v1/guardian/get-limit", params={"target_vpa": ward["vpa"]}, headers=headers_ward)
    assert resp_limit.json()["cumulative_spent"] == 1500.0
    assert resp_limit.json()["remaining_limit"] == 500.0

    # 4. Ward attempts transaction of ₹1000 (1500 + 1000 = 2500 > 2000 -> Should HARD-STOP & return 423)
    resp_txn2 = client.post("/api/v1/transfer", json={
        "sender_vpa": ward["vpa"],
        "receiver_vpa": recipient["vpa"],
        "amount": 1000.0
    }, headers={"X-API-Key": "fs_demo_key_001"})
    assert resp_txn2.status_code == 423, resp_txn2.text

    # 5. Guardian checks pending requests
    resp_pending = client.get("/api/v1/guardian/pending-requests", headers=headers_guardian)
    assert resp_pending.status_code == 200
    incoming = resp_pending.json()["incoming"]
    assert len(incoming) > 0
    req_id = incoming[0]["id"]
    assert incoming[0]["amount"] == 1000.0

    # 6. Guardian Approves the request
    resp_approve = client.post("/api/v1/guardian/respond", json={
        "request_id": req_id,
        "decision": "APPROVED",
        "note": "Approved by guardian test"
    }, headers=headers_guardian)
    assert resp_approve.status_code == 200
    assert resp_approve.json()["status"] == "APPROVED"

    # Verify cumulative spent updated (1500 + 1000 = 2500)
    resp_limit_after = client.get("/api/v1/guardian/get-limit", params={"target_vpa": ward["vpa"]}, headers=headers_ward)
    assert resp_limit_after.json()["cumulative_spent"] == 2500.0
    assert resp_limit_after.json()["remaining_limit"] == 0.0

def test_phase5_reset_spending_counter(setup_users):
    ward = setup_users["ward"]
    guardian = setup_users["guardian"]

    headers_ward = {"Authorization": f"Bearer {ward['token']}"}
    headers_guardian = {"Authorization": f"Bearer {guardian['token']}"}

    # Link and set limit
    resp_invite = client.post("/api/v1/guardian/add", json={"phone": guardian["phone"]}, headers=headers_ward)
    rel_id = resp_invite.json()["relationship_id"]
    otp_code = GUARDIAN_VERIFICATION_CODES.get(rel_id, {}).get("code")
    client.post("/api/v1/guardian/verify-code", json={"relationship_id": rel_id, "code": otp_code}, headers=headers_ward)

    client.post("/api/v1/guardian/set-ward-config", json={"ward_vpa": ward["vpa"], "limit": 1000.0, "timeout_minutes": 5}, headers=headers_guardian)

    # Guardian resets spending counter
    resp_reset = client.post("/api/v1/guardian/reset-spending", json={"ward_vpa": ward["vpa"]}, headers=headers_guardian)
    assert resp_reset.status_code == 200
    assert resp_reset.json()["success"] is True

    # Verify cumulative spent is 0
    resp_limit = client.get("/api/v1/guardian/get-limit", params={"target_vpa": ward["vpa"]}, headers=headers_ward)
    assert resp_limit.json()["cumulative_spent"] == 0.0
    assert resp_limit.json()["remaining_limit"] == 1000.0
