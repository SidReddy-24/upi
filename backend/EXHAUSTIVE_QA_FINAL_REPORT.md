# EXHAUSTIVE API QA SECURITY REPORT

===========================================================
1. Endpoint Coverage %: 100%
2. Number of curl commands executed: 318
3. Number of tests executed: 318
4. Pass count: 313
5. Fail count: 5
20. Overall Production Readiness Score: 98/100
===========================================================

## 🛑 FAILURES DETECTED

### Bug in POST /score
- **Test Category**: Mutated amount with float_instead_of_int
- **Curl Command**: `curl -X POST http://localhost:8001/api/v1/score -H 'X-API-Key: fs_demo_key_001' -H 'Content-Type: application/json' -d '{"transaction_id": "TEST_83f0e4f8-a351-4c98-ae1d-83a80cacf6fd", "sender_vpa": "alice@okaxis", "receiver_vpa": "bob@oksbi", "amount": 3.14159, "currency": "INR", "transaction_type": "P2P", "device": {"device_id": "TEST_DEV", "os_type": "ANDROID"}, "metadata": {"org_id": "TEST_ORG"}}'`
- **HTTP Status**: 200
- **Response**: `{"request_id":"req_b379e5eba7cb","transaction_id":"TEST_83f0e4f8-a351-4c98-ae1d-83a80cacf6fd","scored_at":"2026-07-24T00:05:15.604746","latency_ms":2,"risk_score":0.1005,"confidence":0.7549,"decision"`
- **Expected Result**: Should reject gracefully (4xx status).
- **Severity**: HIGH
---
### Bug in POST /score
- **Test Category**: Mutated amount with bool_instead_of_string
- **Curl Command**: `curl -X POST http://localhost:8001/api/v1/score -H 'X-API-Key: fs_demo_key_001' -H 'Content-Type: application/json' -d '{"transaction_id": "TEST_83f0e4f8-a351-4c98-ae1d-83a80cacf6fd", "sender_vpa": "alice@okaxis", "receiver_vpa": "bob@oksbi", "amount": true, "currency": "INR", "transaction_type": "P2P", "device": {"device_id": "TEST_DEV", "os_type": "ANDROID"}, "metadata": {"org_id": "TEST_ORG"}}'`
- **HTTP Status**: 200
- **Response**: `{"request_id":"req_9c8d59c216ac","transaction_id":"TEST_83f0e4f8-a351-4c98-ae1d-83a80cacf6fd","scored_at":"2026-07-24T00:05:15.614390","latency_ms":3,"risk_score":0.1005,"confidence":0.7549,"decision"`
- **Expected Result**: Should reject gracefully (4xx status).
- **Severity**: HIGH
---
### Bug in POST /feedback
- **Test Category**: Valid Payload
- **Curl Command**: `curl -X POST http://localhost:8001/api/v1/feedback -H 'X-API-Key: fs_demo_key_001' -H 'Content-Type: application/json' -d '{"transaction_id": "TXN_TEST_NORMAL_001", "feedback_type": "CLEAR_FRAUD", "analyst_decision": "LEGITIMATE"}'`
- **HTTP Status**: 404
- **Response**: `{"detail":"Transaction with ID TXN_TEST_NORMAL_001 not found."}`
- **Expected Result**: Should reject gracefully (4xx status).
- **Severity**: MEDIUM
---
### Bug in POST /auth/register
- **Test Category**: Valid Payload
- **Curl Command**: `curl -X POST http://localhost:8001/api/v1/auth/register -H 'Content-Type: application/json' -d '{"phone": "8887c60a7a", "email": "test_130e15a@example.com", "password": "TestPassword123!"}'`
- **HTTP Status**: 422
- **Response**: `{"detail":[{"type":"string_pattern_mismatch","loc":["body","phone"],"msg":"String should match pattern '^\\+?[1-9]\\d{1,14}$'","input":"8887c60a7a","ctx":{"pattern":"^\\+?[1-9]\\d{1,14}$"}}],"body":{"`
- **Expected Result**: Should reject gracefully (4xx status).
- **Severity**: MEDIUM
---
### Bug in POST /auth/login
- **Test Category**: Valid Payload
- **Curl Command**: `curl -X POST http://localhost:8001/api/v1/auth/login -H 'Content-Type: application/json' -d '{"identifier": "9999999999", "password": "TestPassword123!"}'`
- **HTTP Status**: 401
- **Response**: `{"detail":"Invalid credentials"}`
- **Expected Result**: Should reject gracefully (4xx status).
- **Severity**: MEDIUM
---
