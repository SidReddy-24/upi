"""Integration test for authentication API endpoints.

Tests the complete authentication flow end-to-end:
1. Send OTP for registration
2. Verify OTP
3. Register user
4. Login with credentials
5. Refresh access token
6. Reset password flow
7. Logout

This script verifies all authentication endpoints (Tasks 7.2-7.6) work correctly.
"""
import asyncio
import httpx
from datetime import datetime


BASE_URL = "http://localhost:8000/api/v1"


async def test_complete_auth_flow():
    """Test complete authentication flow."""
    print("=" * 70)
    print("AUTHENTICATION API INTEGRATION TEST")
    print("=" * 70)
    
    # Generate unique test data
    timestamp = datetime.now().microsecond
    test_phone = f"555{timestamp:07d}"
    test_email = f"test{timestamp}@example.com"
    test_password = "TestPass123"
    new_password = "NewPass456"
    
    async with httpx.AsyncClient(timeout=10.0) as client:
        
        # ====================================================================
        # Task 7.2: Test OTP Generation (Registration)
        # ====================================================================
        print("\n1. Testing OTP generation for registration...")
        response = await client.post(
            f"{BASE_URL}/auth/send-otp",
            json={
                "phone": test_phone,
                "purpose": "REGISTRATION"
            }
        )
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.json()}")
        assert response.status_code == 200, f"OTP generation failed: {response.text}"
        print("   ✓ OTP sent successfully")
        
        # Extract OTP from console (in real scenario, user would receive via SMS)
        # For demo, we check the backend logs
        print("   → Check backend console for OTP code")
        otp_code = input("   Enter OTP from console: ").strip()
        
        # ====================================================================
        # Task 7.2: Test OTP Verification
        # ====================================================================
        print("\n2. Testing OTP verification...")
        response = await client.post(
            f"{BASE_URL}/auth/verify-otp",
            json={
                "phone": test_phone,
                "otp_code": otp_code,
                "purpose": "REGISTRATION"
            }
        )
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.json()}")
        assert response.status_code == 200, f"OTP verification failed: {response.text}"
        print("   ✓ OTP verified successfully")
        
        # ====================================================================
        # Task 7.3: Test User Registration
        # ====================================================================
        print("\n3. Testing user registration...")
        response = await client.post(
            f"{BASE_URL}/auth/register",
            json={
                "phone": test_phone,
                "password": test_password,
                "email": test_email
            }
        )
        print(f"   Status: {response.status_code}")
        response_data = response.json()
        print(f"   Response: {response_data}")
        assert response.status_code == 201, f"Registration failed: {response.text}"
        
        user_id = response_data["user"]["id"]
        user_vpa = response_data["user"]["vpa"]
        print(f"   ✓ User registered successfully")
        print(f"   User ID: {user_id}")
        print(f"   VPA: {user_vpa}")
        
        # ====================================================================
        # Task 7.3: Test Duplicate Phone Rejection
        # ====================================================================
        print("\n4. Testing duplicate phone rejection...")
        response = await client.post(
            f"{BASE_URL}/auth/register",
            json={
                "phone": test_phone,  # Same phone
                "password": "AnotherPass123",
                "email": f"another{timestamp}@example.com"
            }
        )
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.json()}")
        assert response.status_code == 409, "Duplicate phone should be rejected"
        print("   ✓ Duplicate phone correctly rejected")
        
        # ====================================================================
        # Task 7.4: Test Login with Phone
        # ====================================================================
        print("\n5. Testing login with phone...")
        response = await client.post(
            f"{BASE_URL}/auth/login",
            json={
                "identifier": test_phone,
                "password": test_password
            }
        )
        print(f"   Status: {response.status_code}")
        login_data = response.json()
        print(f"   Response: {login_data}")
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        access_token = login_data["tokens"]["access_token"]
        refresh_token = login_data["tokens"]["refresh_token"]
        print(f"   ✓ Login successful")
        print(f"   Access Token: {access_token[:50]}...")
        print(f"   Refresh Token: {refresh_token[:50]}...")
        
        # ====================================================================
        # Task 7.4: Test Login with Email
        # ====================================================================
        print("\n6. Testing login with email...")
        response = await client.post(
            f"{BASE_URL}/auth/login",
            json={
                "identifier": test_email,
                "password": test_password
            }
        )
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.json()}")
        assert response.status_code == 200, f"Email login failed: {response.text}"
        print("   ✓ Email login successful")
        
        # ====================================================================
        # Task 7.4: Test Login with Wrong Password
        # ====================================================================
        print("\n7. Testing login with wrong password...")
        response = await client.post(
            f"{BASE_URL}/auth/login",
            json={
                "identifier": test_phone,
                "password": "WrongPassword123"
            }
        )
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.json()}")
        assert response.status_code == 401, "Wrong password should be rejected"
        print("   ✓ Wrong password correctly rejected")
        
        # ====================================================================
        # Task 7.5: Test Token Refresh
        # ====================================================================
        print("\n8. Testing token refresh...")
        response = await client.post(
            f"{BASE_URL}/auth/refresh",
            json={
                "refresh_token": refresh_token
            }
        )
        print(f"   Status: {response.status_code}")
        refresh_data = response.json()
        print(f"   Response: {refresh_data}")
        assert response.status_code == 200, f"Token refresh failed: {response.text}"
        
        new_access_token = refresh_data["tokens"]["access_token"]
        print(f"   ✓ Token refreshed successfully")
        print(f"   New Access Token: {new_access_token[:50]}...")
        
        # ====================================================================
        # Task 7.6: Test Password Reset Flow
        # ====================================================================
        print("\n9. Testing password reset flow...")
        
        # Step 1: Send OTP for password reset
        print("   9a. Sending OTP for password reset...")
        response = await client.post(
            f"{BASE_URL}/auth/send-otp",
            json={
                "phone": test_phone,
                "purpose": "PASSWORD_RESET"
            }
        )
        print(f"      Status: {response.status_code}")
        assert response.status_code == 200, f"Password reset OTP failed: {response.text}"
        print("      ✓ Password reset OTP sent")
        
        # Get OTP from console
        reset_otp = input("   Enter password reset OTP from console: ").strip()
        
        # Step 2: Verify OTP
        print("   9b. Verifying password reset OTP...")
        response = await client.post(
            f"{BASE_URL}/auth/verify-otp",
            json={
                "phone": test_phone,
                "otp_code": reset_otp,
                "purpose": "PASSWORD_RESET"
            }
        )
        print(f"      Status: {response.status_code}")
        assert response.status_code == 200, f"OTP verification failed: {response.text}"
        print("      ✓ Password reset OTP verified")
        
        # Step 3: Reset password
        print("   9c. Resetting password...")
        response = await client.post(
            f"{BASE_URL}/auth/reset-password",
            json={
                "phone": test_phone,
                "otp_code": reset_otp,
                "new_password": new_password
            }
        )
        print(f"      Status: {response.status_code}")
        print(f"      Response: {response.json()}")
        assert response.status_code == 200, f"Password reset failed: {response.text}"
        print("      ✓ Password reset successful")
        
        # Step 4: Login with new password
        print("   9d. Testing login with new password...")
        response = await client.post(
            f"{BASE_URL}/auth/login",
            json={
                "identifier": test_phone,
                "password": new_password
            }
        )
        print(f"      Status: {response.status_code}")
        assert response.status_code == 200, f"Login with new password failed: {response.text}"
        new_refresh_token = response.json()["tokens"]["refresh_token"]
        print("      ✓ Login with new password successful")
        
        # ====================================================================
        # Task 7.5: Test Logout
        # ====================================================================
        print("\n10. Testing logout...")
        response = await client.post(
            f"{BASE_URL}/auth/logout",
            json={
                "refresh_token": new_refresh_token
            }
        )
        print(f"    Status: {response.status_code}")
        print(f"    Response: {response.json()}")
        assert response.status_code == 200, f"Logout failed: {response.text}"
        print("    ✓ Logout successful")
        
        # ====================================================================
        # Test using revoked refresh token (should fail)
        # ====================================================================
        print("\n11. Testing revoked token rejection...")
        response = await client.post(
            f"{BASE_URL}/auth/refresh",
            json={
                "refresh_token": new_refresh_token  # This was revoked in logout
            }
        )
        print(f"    Status: {response.status_code}")
        print(f"    Response: {response.json()}")
        assert response.status_code == 401, "Revoked token should be rejected"
        print("    ✓ Revoked token correctly rejected")
        
        # ====================================================================
        # Cleanup
        # ====================================================================
        print("\n12. Cleanup test data...")
        # Note: In production, you'd want an admin endpoint to delete test users
        # For now, we can manually clean up if needed
        print("    → Test user remains in database for inspection")
        print(f"    → Phone: {test_phone}")
        print(f"    → Email: {test_email}")
        print(f"    → VPA: {user_vpa}")
    
    print("\n" + "=" * 70)
    print("✓ ALL AUTHENTICATION TESTS PASSED")
    print("=" * 70)


if __name__ == "__main__":
    print("\nMake sure the backend is running at http://localhost:8000")
    print("Starting tests in 3 seconds...\n")
    asyncio.run(test_complete_auth_flow())
