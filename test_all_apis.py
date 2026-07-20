#!/usr/bin/env python3
"""
FraudShield AI — API Test Suite (stdlib only, uses urllib)
"""
import json
import urllib.request
import urllib.error
from datetime import datetime

BASE_URL = "http://localhost:8000"
API_KEY = "fs_demo_key_001"
HEADERS = {"X-API-Key": API_KEY, "Content-Type": "application/json"}

PASS = "✅ PASS"
FAIL = "❌ FAIL"
SEP = "─" * 65

results = {}

def request(method, path, headers=None, body=None, timeout=20):
    url = f"{BASE_URL}{path}"
    h = dict(HEADERS)
    if headers:
        h.update(headers)
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, resp.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()
    except Exception as ex:
        return None, str(ex)

def print_result(name, status_code, expected, raw_body):
    ok = (status_code == expected)
    label = PASS if ok else FAIL
    print(f"\n{SEP}")
    print(f"{label}  {name}")
    print(f"   HTTP Status : {status_code}  (expected {expected})")
    try:
        parsed = json.loads(raw_body)
        pretty = json.dumps(parsed, indent=3)
        # Only print first 1500 chars to keep output readable
        if len(pretty) > 1500:
            pretty = pretty[:1500] + "\n   ... (truncated)"
        print(f"   Response:\n{pretty}")
    except Exception:
        print(f"   Response: {raw_body[:400]}")
    return ok

print(f"\n{'═'*65}")
print("   FraudShield AI — Full API Test Suite")
print(f"   {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
print(f"{'═'*65}")

# ── 1. Root ──────────────────────────────────────────────────
sc, body = request("GET", "/")
results["GET /"] = print_result("GET /  (Root)", sc, 200, body)

# ── 2. Health Check ──────────────────────────────────────────
sc, body = request("GET", "/api/v1/health", headers={})
results["GET /health"] = print_result("GET /api/v1/health  (System Health)", sc, 200, body)

# ── 3. Score — Normal Transaction ────────────────────────────
score_payload = {
    "transaction_id": "TXN_TEST_NORMAL_001",
    "sender_vpa": "alice@okaxis",
    "receiver_vpa": "bob@oksbi",
    "amount": 15000.00,
    "currency": "INR",
    "transaction_type": "P2P",
    "timestamp": datetime.utcnow().isoformat() + "Z",
    "device": {
        "device_id": "DEV_ABC123",
        "os_type": "ANDROID",
        "os_version": "13",
        "app_version": "3.2.1",
        "is_rooted": False,
        "is_emulator": False,
        "screen_resolution": "1080x2400"
    },
    "location": {"latitude": 12.9716, "longitude": 77.5946, "accuracy_meters": 15, "location_method": "GPS"},
    "network": {"ip_address": "192.168.1.10", "connection_type": "4G", "isp": "Airtel"},
    "metadata": {"org_id": "ORG_DEMO_001", "channel": "mobile_app", "session_id": "SESS_XYZ_001"}
}
sc, body = request("POST", "/api/v1/score", body=score_payload)
results["POST /score (normal)"] = print_result("POST /api/v1/score  (Normal Transaction)", sc, 200, body)
try:
    scored_txn_id = json.loads(body).get("transaction_id", "TXN_TEST_NORMAL_001") if sc == 200 else "TXN_TEST_NORMAL_001"
except Exception:
    scored_txn_id = "TXN_TEST_NORMAL_001"

# ── 4. Score — High Risk Transaction ─────────────────────────
high_risk_payload = {
    "transaction_id": "TXN_TEST_FRAUD_002",
    "sender_vpa": "suspicious@okicici",
    "receiver_vpa": "mule@okhdfc",
    "amount": 199999.00,
    "currency": "INR",
    "transaction_type": "P2P",
    "timestamp": datetime.utcnow().isoformat() + "Z",
    "device": {
        "device_id": "DEV_FRAUD_999",
        "os_type": "ANDROID",
        "os_version": "8",
        "is_rooted": True,
        "is_emulator": True
    },
    "network": {"ip_address": "1.2.3.4", "connection_type": "Wifi"},
    "metadata": {"org_id": "ORG_DEMO_001", "channel": "mobile_app"}
}
sc, body = request("POST", "/api/v1/score", body=high_risk_payload)
results["POST /score (high-risk)"] = print_result("POST /api/v1/score  (High-Risk / Fraud Scenario)", sc, 200, body)

# ── 5. Score — P2M Merchant ──────────────────────────────────
p2m_payload = {
    "transaction_id": "TXN_P2M_003",
    "sender_vpa": "customer@ybl",
    "receiver_vpa": "merchant.zomato@okhdfc",
    "amount": 450.00,
    "currency": "INR",
    "transaction_type": "P2M",
    "timestamp": datetime.utcnow().isoformat() + "Z",
    "device": {"device_id": "DEV_CUST_567", "os_type": "IOS", "os_version": "17", "is_rooted": False, "is_emulator": False},
    "location": {"latitude": 28.6139, "longitude": 77.2090, "location_method": "GPS"},
    "network": {"ip_address": "10.0.0.5", "connection_type": "Wifi", "isp": "Jio"},
    "metadata": {"org_id": "ORG_DEMO_001", "channel": "mobile_app"}
}
sc, body = request("POST", "/api/v1/score", body=p2m_payload)
results["POST /score (P2M)"] = print_result("POST /api/v1/score  (P2M Merchant Payment)", sc, 200, body)

# ── 6. Risk Details ───────────────────────────────────────────
sc, body = request("GET", f"/api/v1/risk/{scored_txn_id}")
results["GET /risk/{id}"] = print_result(f"GET /api/v1/risk/{scored_txn_id}  (Risk Details)", sc, 200, body)

# ── 7. Risk — Not Found ───────────────────────────────────────
sc, body = request("GET", "/api/v1/risk/NONEXISTENT_TXN_XYZ")
results["GET /risk (404)"] = print_result("GET /api/v1/risk/NONEXISTENT_TXN_XYZ  (Expected 404)", sc, 404, body)

# ── 8. Analytics Dashboard ────────────────────────────────────
sc, body = request("GET", "/api/v1/analytics?period=24h")
results["GET /analytics"] = print_result("GET /api/v1/analytics  (Dashboard Analytics)", sc, 200, body)

# ── 9. Model Registry ─────────────────────────────────────────
sc, body = request("GET", "/api/v1/model")
results["GET /model"] = print_result("GET /api/v1/model  (Model Registry)", sc, 200, body)

# ── 10. Feedback — Legitimate ─────────────────────────────────
feedback_payload = {
    "transaction_id": scored_txn_id,
    "feedback_type": "CLEAR_FRAUD",
    "analyst_decision": "LEGITIMATE",
    "fraud_type": None,
    "notes": "Customer confirmed — legitimate purchase",
    "escalate_to_case": False
}
sc, body = request("POST", "/api/v1/feedback", body=feedback_payload)
results["POST /feedback (legit)"] = print_result("POST /api/v1/feedback  (Mark Legitimate)", sc, 200, body)

# ── 11. Feedback — Fraud with case escalation ─────────────────
fraud_feedback_payload = {
    "transaction_id": "TXN_TEST_FRAUD_002",
    "feedback_type": "CONFIRM_FRAUD",
    "analyst_decision": "FRAUD",
    "fraud_type": "ACCOUNT_TAKEOVER",
    "notes": "Confirmed fraud via device + IP cross-check",
    "escalate_to_case": True
}
sc, body = request("POST", "/api/v1/feedback", body=fraud_feedback_payload)
results["POST /feedback (fraud)"] = print_result("POST /api/v1/feedback  (Confirm Fraud + Escalate)", sc, 200, body)

# ── 12. Auth — Invalid API Key ────────────────────────────────
sc, body = request("GET", "/api/v1/model", headers={"X-API-Key": "INVALID_KEY_999"})
results["Auth: invalid key"] = print_result("GET /api/v1/model  (Auth: Invalid Key → 401)", sc, 401, body)

# ── 13. Score — Validation Error (bad VPA, negative amount) ──
bad_payload = {
    "transaction_id": "BAD", "sender_vpa": "novat",
    "receiver_vpa": "alsononat", "amount": -500,
    "device": {"device_id": "X"}, "metadata": {"org_id": "O"}
}
sc, body = request("POST", "/api/v1/score", body=bad_payload)
results["POST /score (validation error)"] = print_result("POST /api/v1/score  (Validation: Bad Payload → 422)", sc, 422, body)

# ── Summary ───────────────────────────────────────────────────
print(f"\n{'═'*65}")
print("   FINAL SUMMARY")
print(f"{'═'*65}")
passed = sum(1 for v in results.values() if v)
total = len(results)
for name, ok in results.items():
    icon = "✅" if ok else "❌"
    print(f"   {icon}  {name}")
print(f"\n   Result: {passed}/{total} tests passed {'🎉' if passed == total else '⚠️'}")
print(f"{'═'*65}\n")
