"""
SentinelPay AI — Comprehensive E2E User Flow QA Test Suite.
Tests all user flows across Authentication, P2P Transfers, QR Trust Engine,
Multi-User Search, Guardian Linking & High-Risk Approvals, AI Scam Assistant,
Community Reports, Scam Heatmap, and System Monitoring.
"""
import time
import json
import urllib.request
import urllib.error
import sys

BASE_URL = "https://upi-nd1p.onrender.com/api/v1"
API_KEY = "fs_demo_key_001"

test_results = []

def run_test(name, method, endpoint, payload=None, expected_status=200, headers=None):
    if headers is None:
        headers = {}
    headers["Content-Type"] = "application/json"
    headers["X-API-Key"] = API_KEY

    url = f"{BASE_URL}{endpoint}" if endpoint.startswith("/") else endpoint
    data_bytes = json.dumps(payload).encode('utf-8') if payload else None

    req = urllib.request.Request(url, data=data_bytes, headers=headers, method=method)
    t0 = time.time()
    
    status_code = 0
    resp_body = {}
    error_msg = None

    try:
        with urllib.request.urlopen(req, timeout=25) as response:
            status_code = response.status
            raw_data = response.read().decode('utf-8')
            resp_body = json.loads(raw_data) if raw_data else {}
    except urllib.error.HTTPError as e:
        status_code = e.code
        raw_data = e.read().decode('utf-8')
        try:
            resp_body = json.loads(raw_data)
        except:
            resp_body = {"raw": raw_data}
    except Exception as e:
        error_msg = str(e)

    latency = round((time.time() - t0) * 1000, 2)
    passed = (status_code == expected_status) and (error_msg is None)

    result = {
        "name": name,
        "method": method,
        "endpoint": endpoint,
        "expected_status": expected_status,
        "actual_status": status_code,
        "latency_ms": latency,
        "passed": passed,
        "error": error_msg,
        "response": resp_body
    }
    test_results.append(result)
    
    icon = "✅" if passed else "❌"
    print(f"{icon} [{status_code}] {name} ({latency}ms)")
    if not passed:
        print(f"   ↳ Error/Body: {error_msg or resp_body}")
    return resp_body

def main():
    print(f"\n{'='*70}")
    print(f"🚀 SENTINELPAY E2E USER FLOW QA TEST SUITE")
    print(f"{'='*70}\n")

    # ── 1. AUTHENTICATION & USER PROFILE FLOW ──────────────────────────────
    print("--- 1. AUTHENTICATION & USER PROFILE FLOW ---")
    
    # 1.1 Send OTP for signup
    timestamp_suffix = str(int(time.time()))[-6:]
    test_phone = f"9876{timestamp_suffix}"
    otp_res = run_test("Auth: Send OTP for Registration", "POST", "/auth/send-otp", {
        "phone": test_phone,
        "purpose": "REGISTRATION"
    })
    
    # 1.2 Verify OTP
    run_test("Auth: Verify OTP Code", "POST", "/auth/verify-otp", {
        "phone": test_phone,
        "otp_code": "123456"
    })

    # 1.3 Register user profile
    reg_res = run_test("Auth: Register New User Profile", "POST", "/auth/register", {
        "phone": test_phone,
        "name": f"QA User {timestamp_suffix}",
        "email": f"qatester_{timestamp_suffix}@sentinelpay.ai",
        "password": "SentinelPass_1234!"
    }, expected_status=200)

    access_token = reg_res.get("access_token") if isinstance(reg_res, dict) else None

    # Fallback to login as demo user if reg token fails
    if not access_token:
        login_res = run_test("Auth: Fallback Login as Demo User", "POST", "/auth/login", {
            "phone": "9892150232",
            "password": "demo_password"
        }, expected_status=200)
        access_token = login_res.get("access_token") if isinstance(login_res, dict) else None

    auth_headers = {"Authorization": f"Bearer {access_token}"} if access_token else {}

    # 1.4 Get Profile
    run_test("User: Get Profile by Phone", "GET", f"/user/profile/{test_phone}")
    run_test("User: Get Profile by VPA", "GET", "/user/profile/demo@sentinelpay")

    # ── 2. P2P PAYMENT & ATOMIC SETTLEMENT FLOW ───────────────────────────
    print("\n--- 2. P2P PAYMENT & ATOMIC SETTLEMENT FLOW ---")

    # 2.1 Score legitimate transaction
    txn_id = f"TXN_QA_{int(time.time())}"
    score_res = run_test("Scoring: Legitimate P2P Transfer", "POST", "/score", {
        "transaction_id": txn_id,
        "sender_vpa": "demo@sentinelpay",
        "receiver_vpa": "alice@sentinelpay",
        "amount": 500.0,
        "currency": "INR",
        "transaction_type": "P2P",
        "device": {"device_id": "DEV_QA_001", "os_type": "ANDROID", "is_rooted": False, "is_emulator": False},
        "location": {"latitude": 12.9716, "longitude": 77.5946},
        "network": {"ip_address": "103.21.58.200", "connection_type": "4G"},
        "metadata": {"org_id": "ORG_DEMO_001", "channel": "mobile_app"}
    })

    # 2.2 Execute P2P Settlement
    transfer_res = run_test("Transfer: Execute Atomic P2P Settlement", "POST", "/transfer", {
        "transaction_id": txn_id,
        "sender_vpa": "demo@sentinelpay",
        "receiver_vpa": "alice@sentinelpay",
        "amount": 500.0,
        "note": "QA Test Split"
    })

    # 2.3 Verify Transaction History
    run_test("Ledger: Fetch Sender Transactions", "GET", "/user/transactions/demo@sentinelpay")
    run_test("Ledger: Fetch Receiver Transactions", "GET", "/user/transactions/alice@sentinelpay")

    # ── 3. QR TRUST ENGINE & BLACKLIST FLOW ────────────────────────────────
    print("\n--- 3. QR TRUST ENGINE & BLACKLIST FLOW ---")

    run_test("QR Trust: Clean Merchant VPA", "GET", "/qr/trust/starbucks@sentinelpay")
    run_test("QR Trust: Blacklisted Scam VPA", "GET", "/qr/trust/scammer@sentinelpay")

    # ── 4. MULTI-USER CONTACT SEARCH ────────────────────────────────────────
    print("\n--- 4. MULTI-USER CONTACT SEARCH ---")

    run_test("Search: Query Users by Partial Name/VPA", "GET", "/user/search?q=alice")
    run_test("Search: Query Users by Phone Number", "GET", "/user/search?q=9892150232")

    # ── 5. GUARDIAN SAFETY NET & APPROVAL FLOW ─────────────────────────────
    print("\n--- 5. GUARDIAN SAFETY NET & APPROVAL FLOW ---")

    # 5.1 Invite Guardian
    add_g_res = run_test("Guardian: Invite Guardian", "POST", "/guardian/add", {
        "vpa": "guardian@sentinelpay"
    }, headers=auth_headers)

    rel_id = add_g_res.get("relationship_id") if isinstance(add_g_res, dict) else None

    # 5.2 List Guardians & Wards
    list_g_res = run_test("Guardian: List Relationships", "GET", "/guardian/list", headers=auth_headers)
    
    # 5.3 Verify Guardian Code (if rel_id exists)
    if rel_id:
        run_test("Guardian: Verify OTP Code", "POST", "/guardian/verify-code", {
            "relationship_id": rel_id,
            "code": "123456"
        }, headers=auth_headers)

    # 5.4 Set & Get Guardian Limit Threshold
    run_test("Guardian: Set Spending Limit", "POST", "/guardian/set-limit", {
        "limit": 10000.0,
        "ward_vpa": "demo@sentinelpay"
    }, headers=auth_headers)

    run_test("Guardian: Get Spending Limit", "GET", "/guardian/get-limit?target_vpa=demo@sentinelpay", headers=auth_headers)

    # 5.5 High-risk transaction approval request
    high_risk_txn_id = f"TXN_HIGH_{int(time.time())}"
    req_app_res = run_test("Guardian: Request Approval for High-Risk Payment", "POST", "/guardian/request-approval", {
        "transaction_id": high_risk_txn_id,
        "amount": 25000.0,
        "recipient_vpa": "scammer@sentinelpay",
        "fraud_score": 0.85,
        "risk_signals": ["HIGH_AMOUNT", "BLACK_LISTED_VPA"]
    }, headers=auth_headers)

    # 5.6 Guardian respond to request
    req_id = high_risk_txn_id  # Or request ID from response
    run_test("Guardian: Respond Approval (APPROVED)", "POST", "/guardian/respond", {
        "request_id": req_id,
        "decision": "APPROVED",
        "note": "Verified by guardian"
    }, headers=auth_headers)

    # 5.7 Check request status
    run_test("Guardian: Check Request Status", "GET", f"/guardian/request-status/{high_risk_txn_id}", headers=auth_headers)

    # ── 6. AI SCAM ASSISTANT & COMMUNITY REPORTING FLOW ────────────────────
    print("\n--- 6. AI SCAM ASSISTANT & COMMUNITY REPORTING FLOW ---")

    run_test("Assistant: Analyze Suspicious Text", "POST", "/assistant/analyze", {
        "query_text": "You have won a free lottery of 1,00,000 INR! Pay 500 processing fee to claim at bonus@upi"
    })

    run_test("Community: Submit Fraud Report", "POST", "/community/report", {
        "entity_id": "lottery_scam@upi",
        "entity_type": "VPA",
        "category": "LOTTERY_FRAUD",
        "description": "Fake lottery fee request"
    })

    run_test("Passport: Get Entity Scam Passport", "GET", "/passport/scammer@sentinelpay")

    # ── 7. SCAM HEATMAP & SYSTEM MONITORING ────────────────────────────────
    print("\n--- 7. SCAM HEATMAP & SYSTEM MONITORING ---")

    run_test("Heatmap: Get Threat Heatmap Data", "GET", "/heatmap")
    run_test("Analytics: Get Period Summary", "GET", "/analytics?period=24h")
    run_test("Health: Check Infrastructure Health", "GET", "/health")

    # ── SUMMARY & REPORT GENERATION ────────────────────────────────────────
    total = len(test_results)
    passed_count = sum(1 for r in test_results if r["passed"])
    failed_count = total - passed_count
    avg_latency = round(sum(r["latency_ms"] for r in test_results) / total, 2) if total > 0 else 0.0

    print(f"\n{'='*70}")
    print(f"📊 E2E QA TEST SUITE SUMMARY")
    print(f"{'='*70}")
    print(f"  Total Test Cases : {total}")
    print(f"  Passed           : {passed_count} ✅")
    print(f"  Failed           : {failed_count} {'❌' if failed_count > 0 else '🎉'}")
    print(f"  Pass Rate        : {round((passed_count/total)*100, 1)}%")
    print(f"  Avg Latency      : {avg_latency} ms")
    print(f"{'='*70}\n")

    if failed_count > 0:
        print("❌ FAILED TEST DETAILS:")
        for r in test_results:
            if not r["passed"]:
                print(f"  • [{r['actual_status']}] {r['name']} ({r['method']} {r['endpoint']}) -> {r.get('error') or r.get('response')}")
        sys.exit(1)
    else:
        print("✨ ALL USER FLOWS TESTED 100% CLEAN WITH NO UNEXPECTED BEHAVIORS!")

if __name__ == "__main__":
    main()
