import httpx
import json
import time
import os
import uuid
import datetime

BASE_URL = "http://localhost:8001/api/v1"
API_KEY = "fs_demo_key_001"

ENDPOINTS = [
    {"method": "GET", "path": "/health", "payload": None, "auth": False},
    {"method": "GET", "path": "/model", "payload": None, "auth": True},
    {"method": "GET", "path": "/analytics", "payload": None, "auth": True},
    {"method": "POST", "path": "/score", "auth": True, "payload": {
        "transaction_id": f"TEST_{uuid.uuid4()}",
        "sender_vpa": "alice@okaxis",
        "receiver_vpa": "bob@oksbi",
        "amount": 100.0,
        "currency": "INR",
        "transaction_type": "P2P",
        "device": {"device_id": "TEST_DEV", "os_type": "ANDROID"},
        "metadata": {"org_id": "TEST_ORG"}
    }},
    {"method": "POST", "path": "/feedback", "auth": True, "payload": {
        "transaction_id": "TXN_TEST_NORMAL_001",
        "feedback_type": "CLEAR_FRAUD",
        "analyst_decision": "LEGITIMATE"
    }},
    {"method": "POST", "path": "/auth/send-otp", "auth": False, "payload": {
        "phone": "9999999999",
        "purpose": "REGISTRATION"
    }},
    {"method": "POST", "path": "/auth/register", "auth": False, "payload": {
        "phone": f"888{uuid.uuid4().hex[:7]}",
        "email": f"test_{uuid.uuid4().hex[:7]}@example.com",
        "password": "TestPassword123!"
    }},
]

PAYLOADS = {
    "missing_fields": {},
    "empty_body": "",
    "malformed_json": "{bad_json:",
    "sql_injection": {"transaction_id": "' OR 1=1 --", "phone": "105 OR 1=1"},
    "xss": {"sender_vpa": "<script>alert(1)</script>"},
    "null_values": {"amount": None, "device": None},
    "negative_values": {"amount": -5000.0},
    "zero_values": {"amount": 0},
    "huge_values": {"amount": 999999999999999.0},
    "unicode_chars": {"sender_vpa": "🔥😈@okaxis"},
    "long_strings": {"sender_vpa": "A" * 10000 + "@okaxis"}
}

results = []
curl_logs = []

def generate_curl(method, url, headers, data):
    h_str = " ".join([f"-H '{k}: {v}'" for k, v in headers.items()])
    d_str = f"-d '{json.dumps(data)}'" if data else ""
    return f"curl -X {method} {url} {h_str} {d_str}"

def run_tests():
    print("Starting Security QA Runner...")
    
    for ep in ENDPOINTS:
        method = ep["method"]
        path = ep["path"]
        base_payload = ep["payload"]
        
        # 1. Valid Request
        headers = {"X-API-Key": API_KEY} if ep["auth"] else {}
        if base_payload: headers["Content-Type"] = "application/json"
        
        try:
            r = httpx.request(method, BASE_URL + path, headers=headers, json=base_payload if isinstance(base_payload, dict) else None, timeout=5.0)
            results.append({
                "endpoint": f"{method} {path}",
                "test": "Valid Request",
                "status": r.status_code,
                "passed": r.status_code in [200, 201]
            })
            curl_logs.append(generate_curl(method, BASE_URL + path, headers, base_payload))
        except Exception as e:
            results.append({"endpoint": f"{method} {path}", "test": "Valid Request", "status": "ERROR", "passed": False})

        # 2. Failure Cases
        if base_payload and isinstance(base_payload, dict):
            for test_name, evil_data in PAYLOADS.items():
                if test_name == "empty_body":
                    try:
                        r = httpx.request(method, BASE_URL + path, headers=headers, data="", timeout=5.0)
                        results.append({"endpoint": f"{method} {path}", "test": "empty_body", "status": r.status_code, "passed": r.status_code in [400, 422]})
                        curl_logs.append(generate_curl(method, BASE_URL + path, headers, ""))
                    except: pass
                elif test_name == "malformed_json":
                    try:
                        r = httpx.request(method, BASE_URL + path, headers={"Content-Type": "application/json", **headers}, data="{bad json", timeout=5.0)
                        results.append({"endpoint": f"{method} {path}", "test": "malformed_json", "status": r.status_code, "passed": r.status_code in [400, 422]})
                    except: pass
                else:
                    mutated = dict(base_payload)
                    for k in mutated.keys():
                        if k in evil_data:
                            mutated[k] = evil_data[k]
                        elif list(evil_data.values()) and type(mutated[k]) == type(list(evil_data.values())[0]):
                            mutated[k] = list(evil_data.values())[0]
                            
                    try:
                        r = httpx.request(method, BASE_URL + path, headers=headers, json=mutated, timeout=5.0)
                        passed = r.status_code in [400, 422, 401, 404]  # We EXPECT these to fail validation!
                        results.append({"endpoint": f"{method} {path}", "test": test_name, "status": r.status_code, "passed": passed})
                        curl_logs.append(generate_curl(method, BASE_URL + path, headers, mutated))
                    except: pass

        # Missing Auth
        if ep["auth"]:
            try:
                r = httpx.request(method, BASE_URL + path, json=base_payload, timeout=5.0)
                results.append({"endpoint": f"{method} {path}", "test": "Missing Auth", "status": r.status_code, "passed": r.status_code in [401, 403]})
                curl_logs.append(generate_curl(method, BASE_URL + path, {}, base_payload))
            except: pass

    # Generate Report
    with open("QA_FINAL_REPORT.md", "w") as f:
        f.write("# API QA Security Report\n\n")
        f.write("-------------------------------------------------\n")
        
        total = len(results)
        passed = sum(1 for r in results if r["passed"])
        failed = total - passed
        
        f.write(f"Coverage: Core Endpoints Tested\n")
        f.write(f"Tests Generated: {total}\n")
        f.write(f"Passed: {passed}\n")
        f.write(f"Failed: {failed}\n\n")
        
        f.write("Potential Bugs & Missing Validation:\n")
        for r in results:
            if not r["passed"]:
                if r["status"] == 500:
                    f.write(f"- [500 Server Error] {r['endpoint']} failed on '{r['test']}'. Potential Missing Validation Detected.\n")
                elif r["status"] in [200, 201]:
                    f.write(f"- [Unexpected Success] {r['endpoint']} succeeded on '{r['test']}' when it should have failed. Potential Missing Validation Detected.\n")
                else:
                    f.write(f"- [Unexpected Status {r['status']}] {r['endpoint']} on '{r['test']}'.\n")
        
        f.write("\nRecommended Fixes:\n")
        f.write("- Ensure Pydantic models strictly validate boundaries (e.g. amount > 0, len(str) < 255).\n")
        f.write("- Add global exception handlers for malformed JSON to return 400 instead of 500.\n")
        f.write("-------------------------------------------------\n\n")
        
        f.write("## Generated cURL Commands\n```bash\n")
        for curl in curl_logs:
            f.write(curl + "\n")
        f.write("```\n")

    print("Report generated: QA_FINAL_REPORT.md")

if __name__ == "__main__":
    run_tests()
