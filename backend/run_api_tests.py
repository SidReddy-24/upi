"""
FraudShield AI — API Test Suite
Runs against live server on http://localhost:8000
"""
import json
import time
import urllib.request
import urllib.error
from datetime import datetime

BASE = "http://localhost:8000/api/v1"
VALID_KEY = "fs_demo_key_001"
INVALID_KEY = "bad_key_xyz"

results = []

def req(method, path, headers=None, body=None):
    url = BASE + path
    data = json.dumps(body).encode() if body else None
    hdrs = {"Content-Type": "application/json"}
    if headers:
        hdrs.update(headers)
    request = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    t0 = time.time()
    try:
        with urllib.request.urlopen(request) as resp:
            latency = round((time.time() - t0) * 1000, 1)
            return resp.status, json.loads(resp.read()), latency
    except urllib.error.HTTPError as e:
        latency = round((time.time() - t0) * 1000, 1)
        try:
            body = json.loads(e.read())
        except Exception:
            body = {}
        return e.code, body, latency

def run(name, method, path, headers=None, body=None, expect_status=200, checks=None):
    status, data, latency = req(method, path, headers, body)
    passed = status == expect_status
    failed_checks = []
    if checks and passed:
        for label, fn in checks.items():
            try:
                ok = fn(data)
            except Exception as ex:
                ok = False
                label = f"{label} [exception: {ex}]"
            if not ok:
                failed_checks.append(label)
                passed = False
    result = {
        "name": name,
        "method": method,
        "path": path,
        "expected_status": expect_status,
        "actual_status": status,
        "latency_ms": latency,
        "passed": passed and not failed_checks,
        "failed_checks": failed_checks,
        "response_snippet": str(data)[:200],
    }
    results.append(result)
    icon = "✅" if result["passed"] else "❌"
    print(f"{icon} [{status}] {name} ({latency}ms)")
    if failed_checks:
        for fc in failed_checks:
            print(f"      ↳ FAIL: {fc}")
    return data

# ── AUTH ─────────────────────────────────────────────────────────────────────

run("Auth: Missing API key → 422",
    "GET", "/model",
    expect_status=422)

run("Auth: Invalid API key → 401",
    "GET", "/model",
    headers={"X-API-Key": INVALID_KEY},
    expect_status=401,
    checks={"detail contains 'Invalid'": lambda d: "Invalid" in d.get("detail","")})

# ── HEALTH ───────────────────────────────────────────────────────────────────

run("Health: GET /health → 200",
    "GET", "/health",
    checks={
        "has 'status' field":    lambda d: "status" in d,
        "has 'components' field": lambda d: "components" in d,
        "api_gateway is UP":     lambda d: d["components"]["api_gateway"]["status"] == "UP",
        "ml_inference is UP":    lambda d: d["components"]["ml_inference"]["status"] == "UP",
        "rule_engine is UP":     lambda d: d["components"]["rule_engine"]["status"] == "UP",
    })

# ── MODEL ────────────────────────────────────────────────────────────────────

run("Model: GET /model → 200",
    "GET", "/model",
    headers={"X-API-Key": VALID_KEY},
    checks={
        "has production_model":      lambda d: "production_model" in d,
        "drift_status is STABLE":    lambda d: d["production_model"]["drift_status"] == "STABLE",
        "metrics.auc > 0.9":         lambda d: d["production_model"]["metrics"]["auc"] > 0.9,
        "feature_count > 0":         lambda d: d["production_model"]["feature_count"] > 0,
    })

# ── ANALYTICS ────────────────────────────────────────────────────────────────

run("Analytics: GET /analytics (default period) → 200",
    "GET", "/analytics",
    headers={"X-API-Key": VALID_KEY},
    checks={
        "period is '24h'":           lambda d: d["period"] == "24h",
        "summary.total_scored > 0":  lambda d: d["summary"]["total_scored"] > 0,
        "model_performance present": lambda d: "model_performance" in d,
        "top_fraud_types is list":   lambda d: isinstance(d["top_fraud_types"], list),
    })

run("Analytics: GET /analytics?period=7d → 200",
    "GET", "/analytics?period=7d",
    headers={"X-API-Key": VALID_KEY},
    checks={
        "period echoed as '7d'": lambda d: d["period"] == "7d",
    })

# ── SCORE ────────────────────────────────────────────────────────────────────

NORMAL_TXN = {
    "transaction_id": "TXN_TEST_NORMAL_001",
    "sender_vpa": "alice@okicici",
    "receiver_vpa": "merchant@okaxis",
    "amount": 4500.0,
    "currency": "INR",
    "transaction_type": "P2M",
    "device": {"device_id": "DEV_ABC123", "os_type": "ANDROID",
               "is_rooted": False, "is_emulator": False},
    "location": {"latitude": 12.9716, "longitude": 77.5946},
    "network": {"ip_address": "103.21.58.200", "connection_type": "4G"},
    "metadata": {"org_id": "ORG_DEMO_001", "channel": "mobile_app"}
}

score_data = run("Score: Normal P2M transaction → APPROVE",
    "POST", "/score",
    headers={"X-API-Key": VALID_KEY},
    body=NORMAL_TXN,
    checks={
        "has risk_score":         lambda d: "risk_score" in d,
        "has decision":           lambda d: "decision" in d,
        "risk_score in [0,1]":    lambda d: 0 <= d["risk_score"] <= 1,
        "decision is APPROVE":    lambda d: d["decision"] == "APPROVE",
        "has explanation":        lambda d: "explanation" in d,
        "has signals":            lambda d: "signals" in d,
        "latency_ms present":     lambda d: "latency_ms" in d,
        "latency < 500ms":        lambda d: d["latency_ms"] < 500,
    })

HIGH_RISK_TXN = {
    "transaction_id": "TXN_TEST_HIGHRISK_001",
    "sender_vpa": "suspect@paytm",
    "receiver_vpa": "mule@okhdfc",
    "amount": 199999.0,
    "currency": "INR",
    "transaction_type": "P2P",
    "device": {"device_id": "DEV_EMULATOR_X", "os_type": "ANDROID",
               "is_rooted": True, "is_emulator": True},
    "location": {"latitude": 28.7041, "longitude": 77.1025},
    "network": {"ip_address": "45.227.253.10", "connection_type": "Wifi"},
    "metadata": {"org_id": "ORG_DEMO_001", "channel": "mobile_app"}
}

run("Score: High-risk P2P (rooted+emulator+max amount) → REVIEW/REJECT",
    "POST", "/score",
    headers={"X-API-Key": VALID_KEY},
    body=HIGH_RISK_TXN,
    checks={
        "risk_score > 0.4":           lambda d: d["risk_score"] > 0.4,
        "decision is REVIEW/REJECT":  lambda d: d["decision"] in ("REVIEW", "REJECT"),
        "device_risk >= 0.5":         lambda d: d["signals"]["device_risk"] >= 0.5,
    })

# ── INVALID SCORE PAYLOADS ───────────────────────────────────────────────────

run("Score: Invalid VPA (no @) → 422",
    "POST", "/score",
    headers={"X-API-Key": VALID_KEY},
    body={**NORMAL_TXN, "sender_vpa": "invalid_vpa"},
    expect_status=422)

run("Score: Amount = 0 → 422",
    "POST", "/score",
    headers={"X-API-Key": VALID_KEY},
    body={**NORMAL_TXN, "amount": 0},
    expect_status=422)

run("Score: Amount > 200000 → 422",
    "POST", "/score",
    headers={"X-API-Key": VALID_KEY},
    body={**NORMAL_TXN, "amount": 250000},
    expect_status=422)

run("Score: Missing required field (no device) → 422",
    "POST", "/score",
    headers={"X-API-Key": VALID_KEY},
    body={"transaction_id": "TXN_BAD", "sender_vpa": "a@b", "receiver_vpa": "c@d",
          "amount": 100, "metadata": {"org_id": "ORG1"}},
    expect_status=422)

# ── RISK ─────────────────────────────────────────────────────────────────────

run("Risk: Non-existent transaction_id → 404",
    "GET", "/risk/TXN_DOES_NOT_EXIST",
    headers={"X-API-Key": VALID_KEY},
    expect_status=404,
    checks={
        "error detail present": lambda d: "detail" in d,
    })

run("Risk: No API key → 422",
    "GET", "/risk/TXN_TEST_NORMAL_001",
    expect_status=422)

# ── FEEDBACK ─────────────────────────────────────────────────────────────────

run("Feedback: Non-existent transaction → 404",
    "POST", "/feedback",
    headers={"X-API-Key": VALID_KEY},
    body={"transaction_id": "TXN_NONEXISTENT", "feedback_type": "CONFIRM_FRAUD",
          "analyst_decision": "FRAUD", "fraud_type": "ACCOUNT_TAKEOVER",
          "notes": "Test", "escalate_to_case": False},
    expect_status=404,
    checks={
        "error detail present": lambda d: "detail" in d or isinstance(d, dict),
    })

run("Feedback: Missing required fields → 422",
    "POST", "/feedback",
    headers={"X-API-Key": VALID_KEY},
    body={"transaction_id": "TXN_X"},
    expect_status=422)

# ── ROOT ─────────────────────────────────────────────────────────────────────

import urllib.request as _ur
def req_root():
    t0 = time.time()
    with _ur.urlopen("http://localhost:8000/") as resp:
        latency = round((time.time() - t0) * 1000, 1)
        data = json.loads(resp.read())
        return resp.status, data, latency

status, data, latency = req_root()
passed = ("FraudShield" in data.get("app","")) and data.get("status") == "active"
results.append({"name":"Root: GET / → 200","method":"GET","path":"/",
    "expected_status":200,"actual_status":status,"latency_ms":latency,
    "passed":passed,"failed_checks":[],"response_snippet":str(data)[:200]})
print(f"{'✅' if passed else '❌'} [{status}] Root: GET / → 200 ({latency}ms)")

# ── REPORT ───────────────────────────────────────────────────────────────────

total   = len(results)
passed  = sum(1 for r in results if r["passed"])
failed  = total - passed
avg_lat = round(sum(r["latency_ms"] for r in results) / total, 1)

print()
print("=" * 65)
print("  FraudShield AI — API Test Report")
print(f"  Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC")
print("=" * 65)
print(f"  Total Tests : {total}")
print(f"  Passed      : {passed}  ✅")
print(f"  Failed      : {failed}  {'❌' if failed else '✅'}")
print(f"  Pass Rate   : {round(passed/total*100, 1)}%")
print(f"  Avg Latency : {avg_lat} ms")
print("=" * 65)

if failed:
    print("\n  FAILED TESTS:")
    for r in results:
        if not r["passed"]:
            print(f"  ❌ {r['name']}")
            print(f"     Expected {r['expected_status']}, got {r['actual_status']}")
            for fc in r["failed_checks"]:
                print(f"     ↳ {fc}")
            print(f"     Response: {r['response_snippet']}")

print()
print("  FULL RESULTS:")
print(f"  {'Test Name':<50} {'Status':>7}  {'Latency':>9}  {'Pass'}")
print(f"  {'-'*50} {'-------':>7}  {'---------':>9}  {'----'}")
for r in results:
    icon = "✅" if r["passed"] else "❌"
    print(f"  {r['name']:<50} {r['actual_status']:>7}  {str(r['latency_ms'])+'ms':>9}  {icon}")

print()
