"""
Automated Integration Test for Guardian Approval System.
Phase 9: SentinelPay Advanced Features.

This script tests:
1. User registration & login (to get JWT tokens for two test users: Alice & Bob)
2. Guardian invitation: Alice invites Bob
3. List guardian relationships: Bob sees Alice's invitation
4. Accept invitation: Bob accepts Alice's invitation
5. WebSocket connection: Bob connects to receive real-time updates
6. Request approval: Alice initiates a high-risk transfer, generating an approval request
7. Real-time broadcast: Bob receives the approval request over WebSocket
8. Respond to request: Bob approves the request
9. Real-time feedback: Alice receives the approval status update
10. Revocation: Alice removes Bob as a guardian
"""

import asyncio
import httpx
import websockets
import json
import psycopg
from psycopg.rows import dict_row
import secrets
import bcrypt
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000/api/v1"
WS_URL = "ws://localhost:8000/api/v1/guardian/ws"

def get_db():
    return psycopg.connect(
        host='localhost',
        port=5432,
        dbname='fraudshield',
        user='fraudshield',
        password='fraudshield_dev',
        row_factory=dict_row
    )

def setup_test_users():
    """Directly insert two users into the DB to avoid SMS/OTP interactive prompts during test."""
    conn = get_db()
    cursor = conn.cursor()
    
    # Clean up old test data if any
    cursor.execute("DELETE FROM auth_users WHERE phone IN ('9999999901', '9999999902')")
    conn.commit()

    # Passwords hashed with bcrypt
    password_hash = bcrypt.hashpw(b"TestPassword123", bcrypt.gensalt(12)).decode('utf-8')
    
    # Alice
    cursor.execute("""
        INSERT INTO auth_users (phone, email, password_hash, vpa, name)
        VALUES ('9999999901', 'alice_test@sentinelpay.com', %s, '9999999901@sentinelpay', 'Alice Test')
        RETURNING id
    """, (password_hash,))
    alice_id = cursor.fetchone()['id']
    
    # Bob
    cursor.execute("""
        INSERT INTO auth_users (phone, email, password_hash, vpa, name)
        VALUES ('9999999902', 'bob_test@sentinelpay.com', %s, '9999999902@sentinelpay', 'Bob Test')
        RETURNING id
    """, (password_hash,))
    bob_id = cursor.fetchone()['id']
    
    conn.commit()
    conn.close()
    
    print("✓ DB Setup: Alice & Bob test users inserted directly.")
    return alice_id, bob_id


async def run_guardian_test():
    alice_id, bob_id = setup_test_users()
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        # 1. Login Alice
        print("\n1. Logging in Alice...")
        login_res = await client.post(f"{BASE_URL}/auth/login", json={
            "identifier": "9999999901",
            "password": "TestPassword123"
        })
        print(f"Login Alice Status: {login_res.status_code}, Body: {login_res.text}")
        assert login_res.status_code == 200
        alice_token = login_res.json()["access_token"]
        alice_headers = {"Authorization": f"Bearer {alice_token}"}
        print("✓ Alice logged in.")

        # 2. Login Bob
        print("\n2. Logging in Bob...")
        login_res2 = await client.post(f"{BASE_URL}/auth/login", json={
            "identifier": "9999999902",
            "password": "TestPassword123"
        })
        print(f"Login Bob Status: {login_res2.status_code}, Body: {login_res2.text}")
        assert login_res2.status_code == 200
        bob_token = login_res2.json()["access_token"]
        bob_headers = {"Authorization": f"Bearer {bob_token}"}
        print("✓ Bob logged in.")

        # 3. Alice adds Bob as a guardian
        print("\n3. Alice invites Bob as a guardian...")
        add_res = await client.post(f"{BASE_URL}/guardian/add", json={
            "vpa": "9999999902@sentinelpay"
        }, headers=alice_headers)
        assert add_res.status_code == 200
        rel_id = add_res.json()["relationship_id"]
        print(f"✓ Bob invited. Relationship ID: {rel_id}")

        # 4. Bob checks list of guardian invites
        print("\n4. Bob lists relationships to find Alice's invite...")
        list_res = await client.get(f"{BASE_URL}/guardian/list", headers=bob_headers)
        assert list_res.status_code == 200
        wards = list_res.json()["wards"]
        pending_ward_invite = [w for w in wards if w["id"] == rel_id and w["status"] == "PENDING"]
        assert len(pending_ward_invite) == 1
        print(f"✓ Bob found pending invite from ward: {pending_ward_invite[0]['ward_name']}")

        # 5. Bob accepts Alice's invitation
        print("\n5. Bob accepts the invitation...")
        accept_res = await client.post(f"{BASE_URL}/guardian/accept-invitation?relationship_id={rel_id}", headers=bob_headers)
        assert accept_res.status_code == 200
        print("✓ Bob accepted. Relationship is now ACTIVE.")

        # 6. WebSocket connections setup
        print("\n6. Opening WebSockets for Alice & Bob...")
        bob_ws_url = f"{WS_URL}?token={bob_token}"
        alice_ws_url = f"{WS_URL}?token={alice_token}"
        
        # Connect Bob's WebSocket to listen for incoming requests
        async with websockets.connect(bob_ws_url) as bob_ws, websockets.connect(alice_ws_url) as alice_ws:
            print("✓ WebSockets connected.")

            # 7. Alice requests approval for a transaction
            print("\n7. Alice requests approval for transaction...")
            req_res = await client.post(f"{BASE_URL}/guardian/request-approval", json={
                "transaction_id": "TXN_TEST_GUARDIAN_001",
                "amount": 15000.00,
                "recipient_vpa": "scammer@okaxis",
                "fraud_score": 0.85,
                "risk_signals": ["CALL_DURING_PAYMENT", "NEW_DEVICE"]
            }, headers=alice_headers)
            assert req_res.status_code == 200
            approval_req_id = req_res.json()["requests"][0]
            print(f"✓ Approval request created: {approval_req_id}")

            # 8. Bob receives request over WebSocket
            print("\n8. Bob checking WebSocket for incoming request...")
            ws_msg = await asyncio.wait_for(bob_ws.recv(), timeout=5.0)
            request_data = json.loads(ws_msg)
            print(f"✓ WebSocket received message: {json.dumps(request_data, indent=2)}")
            assert request_data["type"] == "APPROVAL_REQUEST"
            assert request_data["data"]["request_id"] == approval_req_id

            # 9. Bob responds (approves the transaction)
            print("\n9. Bob responds (APPROVES) via API...")
            respond_res = await client.post(f"{BASE_URL}/guardian/respond", json={
                "request_id": approval_req_id,
                "decision": "APPROVED",
                "note": "Looks safe, discussed over call."
            }, headers=bob_headers)
            assert respond_res.status_code == 200
            print("✓ Bob approved.")

            # 10. Alice receives the approval response over WebSocket
            print("\n10. Alice checking WebSocket for response...")
            alice_ws_msg = await asyncio.wait_for(alice_ws.recv(), timeout=5.0)
            response_data = json.loads(alice_ws_msg)
            print(f"✓ Alice WebSocket received: {json.dumps(response_data, indent=2)}")
            assert response_data["type"] == "APPROVAL_RESPONSE"
            assert response_data["data"]["status"] == "APPROVED"
            
        # 11. Alice removes Bob
        print("\n11. Alice removes Bob from guardians list...")
        remove_res = await client.post(f"{BASE_URL}/guardian/remove?relationship_id={rel_id}", headers=alice_headers)
        assert remove_res.status_code == 200
        print("✓ Bob removed.")

        # 12. Verify status changed to REMOVED
        list_res2 = await client.get(f"{BASE_URL}/guardian/list", headers=alice_headers)
        guardians = list_res2.json()["guardians"]
        assert len([g for g in guardians if g["id"] == rel_id]) == 0
        print("✓ Verification: Relationship no longer exists in active list.")
        
    print("\n🎉 ALL TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    asyncio.run(run_guardian_test())
