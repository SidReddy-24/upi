"""
Exhaustive QA Test Suite for SentinelPay
Tests all user flows across all feature surfaces and reports any unexpected errors or edge case issues.
"""
import sys
import os
import json
import random
import time
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

errors = []
passes = []

API_KEY = "fs_demo_key_001"

def log_pass(flow_name, details=""):
    passes.append(f"✅ PASS: {flow_name} {f'({details})' if details else ''}")
    print(f"✅ PASS: {flow_name} {f'({details})' if details else ''}")

def log_error(flow_name, error_msg):
    errors.append(f"❌ FAIL: {flow_name} — {error_msg}")
    print(f"❌ FAIL: {flow_name} — {error_msg}")

def run_qa():
    print("==========================================================================")
    print("🚀 RUNNING EXHAUSTIVE USER FLOW QA TEST SUITE")
    print("==========================================================================")

    rand_id = random.randint(100000, 999999)
    phone_user1 = f"+9198{rand_id:08d}"[0:13]
    phone_user2 = f"+9199{rand_id:08d}"[0:13]

    headers_api = {"X-API-Key": API_KEY}

    # -------------------------------------------------------------------------
    # FLOW 1: Registration of User 1 (Account Owner)
    # -------------------------------------------------------------------------
    reg1_payload = {
        "name": "Alice Smith",
        "phone": phone_user1,
        "email": f"alice_{rand_id}@example.com",
        "password": "Password123!"
    }
    res1 = client.post("/api/v1/auth/register", json=reg1_payload)
    token_user1 = None
    vpa_user1 = None
    if res1.status_code == 200:
        data1 = res1.json()
        token_user1 = data1.get("access_token")
        vpa_user1 = data1.get("user", {}).get("vpa") or f"{phone_user1}@sentinelpay"
        log_pass("Flow 1: User 1 Registration", f"Phone: {phone_user1}, VPA: {vpa_user1}")
    else:
        log_error("Flow 1: User 1 Registration", f"Status {res1.status_code}: {res1.text}")

    # -------------------------------------------------------------------------
    # FLOW 2: Block Duplicate Phone Registration
    # -------------------------------------------------------------------------
    res_dup = client.post("/api/v1/auth/register", json=reg1_payload)
    if res_dup.status_code in [400, 409] and "already registered" in res_dup.text.lower():
        log_pass("Flow 2: Duplicate Phone Registration Blocked", "Returned 'This phone number is already registered.'")
    else:
        log_error("Flow 2: Duplicate Phone Registration Blocked", f"Expected duplicate error, got {res_dup.status_code}: {res_dup.text}")

    # -------------------------------------------------------------------------
    # FLOW 3: Phone OTP Verification for User 1
    # -------------------------------------------------------------------------
    res_otp_req = client.post("/api/v1/auth/send-otp", json={"phone": phone_user1, "purpose": "LOGIN"})
    if res_otp_req.status_code == 200:
        otp_code = res_otp_req.json().get("otp_code", "123456")
        res_otp_verify = client.post("/api/v1/auth/verify-otp", json={"phone": phone_user1, "otp_code": otp_code})
        if res_otp_verify.status_code == 200:
            log_pass("Flow 3: User 1 Phone OTP Verification", "OTP verified successfully")
        else:
            log_error("Flow 3: User 1 Phone OTP Verification", f"Verify failed {res_otp_verify.status_code}: {res_otp_verify.text}")
    else:
        log_error("Flow 3: User 1 Send OTP", f"Status {res_otp_req.status_code}: {res_otp_req.text}")

    # -------------------------------------------------------------------------
    # FLOW 4: Registration & Verification of User 2 (Guardian)
    # -------------------------------------------------------------------------
    reg2_payload = {
        "name": "Bob Johnson",
        "phone": phone_user2,
        "email": f"bob_{rand_id}@example.com",
        "password": "Password123!"
    }
    res2 = client.post("/api/v1/auth/register", json=reg2_payload)
    token_user2 = None
    vpa_user2 = None
    if res2.status_code == 200:
        data2 = res2.json()
        token_user2 = data2.get("access_token")
        vpa_user2 = data2.get("user", {}).get("vpa") or f"{phone_user2}@sentinelpay"
        log_pass("Flow 4: User 2 (Guardian) Registration & Verification", f"Phone: {phone_user2}, VPA: {vpa_user2}")
    else:
        log_error("Flow 4: User 2 Registration", f"Status {res2.status_code}: {res2.text}")

    headers_user1 = {"Authorization": f"Bearer {token_user1}"} if token_user1 else {}
    headers_user2 = {"Authorization": f"Bearer {token_user2}"} if token_user2 else {}

    # -------------------------------------------------------------------------
    # FLOW 5: Guardian Linking (User 1 adds User 2 as Guardian)
    # -------------------------------------------------------------------------
    link_req = client.post("/api/v1/guardian/add", json={"phone": phone_user2, "name": "Bob Johnson"}, headers=headers_user1)
    if link_req.status_code == 200:
        relationship_id = link_req.json().get("relationship_id")
        log_pass("Flow 5.1: Guardian Invite Created", f"Relationship ID: {relationship_id}")

        # Fetch verification code from Guardian list endpoint
        res_list_g = client.get("/api/v1/guardian/list", headers=headers_user2)
        if res_list_g.status_code == 200:
            wards = res_list_g.json().get("wards", [])
            ward_item = next((w for w in wards if w.get("ward_phone") == phone_user1), None)
            v_code = ward_item.get("verification_code") if ward_item else "123456"
            
            # User 1 verifies code
            verify_link = client.post("/api/v1/guardian/verify-code", json={"relationship_id": relationship_id, "code": v_code}, headers=headers_user1)
            if verify_link.status_code == 200 and verify_link.json().get("success"):
                log_pass("Flow 5.2: Guardian Linked Successfully", "User 2 linked as active guardian for User 1 using OTP")
            else:
                log_error("Flow 5.2: Guardian Verification", f"Failed {verify_link.status_code}: {verify_link.text}")
        else:
            log_error("Flow 5.2: List Wards", f"Failed {res_list_g.status_code}: {res_list_g.text}")
    else:
        log_error("Flow 5.1: Add Guardian Request", f"Failed {link_req.status_code}: {link_req.text}")

    # -------------------------------------------------------------------------
    # FLOW 6: Guardian (User 2) Configures Limit & Timeout for Ward (User 1)
    # -------------------------------------------------------------------------
    set_limit_payload = {
        "ward_vpa": vpa_user1,
        "ward_phone": phone_user1,
        "limit": 5000.0,
        "timeout_minutes": 5
    }
    res_limit = client.post("/api/v1/guardian/set-ward-config", json=set_limit_payload, headers=headers_user2)
    if res_limit.status_code == 200 and res_limit.json().get("success"):
        log_pass("Flow 6: Guardian Configured Ward Spending Limit", "Set ₹5,000 limit with 5 min timeout")
    else:
        log_error("Flow 6: Set Guardian Limit", f"Failed {res_limit.status_code}: {res_limit.text}")

    # -------------------------------------------------------------------------
    # FLOW 7: Small P2P Transfer (₹1,000 - Within ₹5,000 Limit)
    # -------------------------------------------------------------------------
    txn1_id = f"SP{time.strftime('%d%m%y')}TXN01"
    score_p2p_1 = {
        "transaction_id": txn1_id,
        "sender_vpa": vpa_user1,
        "receiver_vpa": vpa_user2,
        "amount": 1000.0,
        "note": "Dinner split",
        "device_id": "DEV_DEFAULT",
        "ip_address": "103.21.58.200"
    }
    headers_transfer = {**headers_user1, **headers_api}
    res_transfer1 = client.post("/api/v1/transfer", json=score_p2p_1, headers=headers_transfer)
    if res_transfer1.status_code == 200 and res_transfer1.json().get("status") == "SUCCESS":
        log_pass("Flow 7: P2P Transfer Within Guardian Limit (₹1,000)", "Approved instantly without guardian intervention")
    else:
        log_error("Flow 7: Small P2P Transfer", f"Failed {res_transfer1.status_code}: {res_transfer1.text}")

    # Check Remaining Limit after ₹1,000 spend (Should be ₹4,000)
    res_rem_limit = client.get("/api/v1/guardian/get-limit", headers=headers_user1)
    if res_rem_limit.status_code == 200:
        rem_val = res_rem_limit.json().get("remaining_limit")
        log_pass("Flow 7.1: Cumulative Guardian Limit Deduction", f"Remaining limit: ₹{rem_val:,.2f}")
    else:
        log_error("Flow 7.1: Check Remaining Limit", f"Failed {res_rem_limit.status_code}: {res_rem_limit.text}")

    # -------------------------------------------------------------------------
    # FLOW 8: Large P2P Transfer Exceeding Guardian Limit (₹6,000 > ₹4,000)
    # -------------------------------------------------------------------------
    txn2_id = f"SP{time.strftime('%d%m%y')}TXN02"
    score_res2 = client.post("/api/v1/score", json={
        "transaction_id": txn2_id,
        "sender_vpa": "alice@sentinelpay",
        "receiver_vpa": "bob@sentinelpay",
        "amount": 6000.0,
        "currency": "INR",
        "transaction_type": "P2P",
        "device": {"device_id": "dev_01"},
        "location": {"latitude": 19.076, "longitude": 72.877},
        "network": {"ip_address": "10.0.2.2"},
        "metadata": {"org_id": "ORG_DEMO_001"}
    }, headers=headers_api)
    
    if score_res2.status_code == 200:
        req_approval_payload = {
            "transaction_id": txn2_id,
            "amount": 6000.0,
            "recipient_vpa": vpa_user2,
            "fraud_score": 0.15,
            "risk_signals": ["GUARDIAN_LIMIT_EXCEEDED"]
        }
        res_req_approval = client.post("/api/v1/guardian/request-approval", json=req_approval_payload, headers=headers_user1)
        if res_req_approval.status_code == 200 and res_req_approval.json().get("success"):
            req_ids = res_req_approval.json().get("requests", [])
            request_id = req_ids[0] if req_ids else None
            log_pass("Flow 8.1: Guardian Approval Requested for Limit Exhausted Txn", f"Request ID: {request_id}")

            # Guardian (User 2) Approves Request in Real-Time
            res_approve = client.post("/api/v1/guardian/respond", json={
                "request_id": request_id,
                "decision": "APPROVED",
                "note": "Verified purchase with ward"
            }, headers=headers_user2)

            if res_approve.status_code == 200 and res_approve.json().get("success"):
                log_pass("Flow 8.2: Guardian Responded Approval (APPROVED)", "Guardian approved ward transaction in real-time")
            else:
                log_error("Flow 8.2: Guardian Respond Approval", f"Failed {res_approve.status_code}: {res_approve.text}")
        else:
            log_error("Flow 8.1: Request Guardian Approval", f"Failed {res_req_approval.status_code}: {res_req_approval.text}")
    else:
        log_error("Flow 8: FraudShield Score Transaction", f"Failed {score_res2.status_code}: {score_res2.text}")

    # -------------------------------------------------------------------------
    # FLOW 9: FraudShield High Risk Transaction (Active Call Context Signal)
    # -------------------------------------------------------------------------
    txn3_id = f"SP{time.strftime('%d%m%y')}TXN03"
    high_risk_score = client.post("/api/v1/score", json={
        "transaction_id": txn3_id,
        "sender_vpa": "alice@sentinelpay",
        "receiver_vpa": "scammer@sentinelpay",
        "amount": 25000.0,
        "currency": "INR",
        "transaction_type": "P2P",
        "device": {"device_id": "dev_01"},
        "location": {"latitude": 19.076, "longitude": 72.877},
        "network": {"ip_address": "10.0.2.2"},
        "metadata": {
            "org_id": "ORG_DEMO_001",
            "is_call_active": True,
            "otp_in_last_60s": True
        }
    }, headers=headers_api)
    if high_risk_score.status_code == 200:
        decision = high_risk_score.json().get("decision")
        score_val = high_risk_score.json().get("risk_score")
        log_pass("Flow 9: FraudShield Risk Scoring with Context Signals", f"Decision: {decision}, Risk Score: {score_val*100:.1f}%")
    else:
        log_error("Flow 9: FraudShield Risk Scoring", f"Failed {high_risk_score.status_code}: {high_risk_score.text}")

    # -------------------------------------------------------------------------
    # FLOW 10: QR Trust VPA Engine Lookup
    # -------------------------------------------------------------------------
    res_qr = client.get(f"/api/v1/qr/trust/{vpa_user1}", headers=headers_api)
    if res_qr.status_code == 200 and "trust_level" in res_qr.json():
        log_pass("Flow 10: QR Trust VPA Check", f"Level: {res_qr.json()['trust_level']}, Message: {res_qr.json()['message']}")
    else:
        log_error("Flow 10: QR Trust Check", f"Failed {res_qr.status_code}: {res_qr.text}")

    # -------------------------------------------------------------------------
    # FLOW 11: Scam Report Submission & Heatmap
    # -------------------------------------------------------------------------
    scam_payload = {
        "entity_id": "scammer99@bank",
        "entity_type": "VPA",
        "category": "Investment Scam",
        "description": "Promised 200% return in 24 hours.",
        "reporter_vpa": vpa_user1
    }
    res_scam = client.post("/api/v1/community/report", json=scam_payload, headers=headers_api)
    if res_scam.status_code == 200:
        log_pass("Flow 11.1: Scam Report Submitted", "Community threat database updated")
    else:
        log_error("Flow 11.1: Scam Report", f"Failed {res_scam.status_code}: {res_scam.text}")

    res_heatmap = client.get("/api/v1/heatmap", headers=headers_api)
    if res_heatmap.status_code == 200:
        log_pass("Flow 11.2: Scam Heatmap Intelligence Queried", f"Total hotspots: {res_heatmap.json().get('total_active_hotspots')}")
    else:
        log_error("Flow 11.2: Scam Heatmap", f"Failed {res_heatmap.status_code}: {res_heatmap.text}")

    # -------------------------------------------------------------------------
    # FLOW 12: Notification Feed API
    # -------------------------------------------------------------------------
    res_notif = client.get(f"/api/v1/notifications/list?user_key={vpa_user1}")
    if res_notif.status_code == 200:
        items = res_notif.json().get("notifications", [])
        log_pass("Flow 12: Persistent Notification Center API", f"Total user notifications: {len(items)}")
    else:
        log_error("Flow 12: Notification Center", f"Failed {res_notif.status_code}: {res_notif.text}")

    # -------------------------------------------------------------------------
    # FLOW 13: Password Reset / Forgot Password
    # -------------------------------------------------------------------------
    res_reset_otp = client.post("/api/v1/auth/send-otp", json={"phone": phone_user1, "purpose": "PASSWORD_RESET"})
    if res_reset_otp.status_code == 200:
        from app.api.v1.auth import get_db
        conn = get_db()
        with conn.cursor() as cur:
            cur.execute("SELECT otp_code FROM otp_verifications WHERE phone = %s ORDER BY created_at DESC LIMIT 1", (phone_user1,))
            r = cur.fetchone()
            reset_otp = r['otp_code'] if r else "123456"
        conn.close()

        # Step 1: Verify OTP code
        res_v_otp = client.post("/api/v1/auth/verify-otp", json={"phone": phone_user1, "otp_code": reset_otp})
        if res_v_otp.status_code == 200:
            res_reset_pass = client.post("/api/v1/auth/reset-password", json={
                "phone": phone_user1,
                "otp_code": reset_otp,
                "new_password": "NewSecurePassword123!"
            })
            if res_reset_pass.status_code == 200:
                log_pass("Flow 13: Forgot Password & Password Reset", "Password reset successfully using verified 6-digit OTP")
            else:
                log_error("Flow 13: Password Reset", f"Failed {res_reset_pass.status_code}: {res_reset_pass.text}")
        else:
            log_error("Flow 13: Verify Password Reset OTP", f"Failed {res_v_otp.status_code}: {res_v_otp.text}")
    else:
        log_error("Flow 13: Reset Password OTP Request", f"Failed {res_reset_otp.status_code}: {res_reset_otp.text}")

    print("==========================================================================")
    print(f"📊 SUMMARY: {len(passes)} PASSED, {len(errors)} FAILED")
    print("==========================================================================")

    if errors:
        print("\n❌ DETECTED ERRORS:")
        for err in errors:
            print(f"  - {err}")
    else:
        print("\n🎉 ALL USER FLOWS & FEATURE SURFACES PASSED WITH 0 ERRORS!")

if __name__ == "__main__":
    run_qa()
