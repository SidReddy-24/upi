"""Demo script to test authentication models.

This script demonstrates:
1. Creating a user
2. Generating and verifying OTP
3. Creating and validating refresh tokens
4. Cascade delete behavior
"""
import asyncio
import random
from datetime import datetime, timedelta
from sqlalchemy import text
from app.db.database import async_session_factory


async def demo_auth_models():
    """Demonstrate authentication models functionality."""
    print("=" * 60)
    print("Authentication Models Demo")
    print("=" * 60)
    
    # Generate unique identifiers for this test
    test_id = datetime.now().microsecond
    test_phone = f"+91987654{test_id % 10000:04d}"
    test_email = f"demo{test_id}@sentinelpay.com"
    test_vpa = f"demouser{test_id}@okhdfc"
    
    async with async_session_factory() as session:
        try:
            # 1. Create a user
            print("\n1. Creating user...")
            result = await session.execute(
                text("""
                INSERT INTO users_auth (phone, email, password_hash, vpa)
                VALUES (:phone, :email, :password_hash, :vpa)
                RETURNING id, phone, email, vpa, created_at
                """),
                {
                    "phone": test_phone,
                    "email": test_email,
                    "password_hash": "$2b$12$examplehashedpassword",
                    "vpa": test_vpa
                }
            )
            user = result.fetchone()
            user_id = user[0]
            await session.commit()
            
            print(f"   ✓ User created:")
            print(f"     - ID: {user_id}")
            print(f"     - Phone: {user[1]}")
            print(f"     - Email: {user[2]}")
            print(f"     - VPA: {user[3]}")
            print(f"     - Created: {user[4]}")
            
            # 2. Generate OTP
            print("\n2. Generating OTP...")
            otp_code = f"{random.randint(0, 999999):06d}"
            expires_at = datetime.utcnow() + timedelta(minutes=5)
            
            await session.execute(
                text("""
                INSERT INTO otp_verifications (phone, otp_code, purpose, expires_at, user_id)
                VALUES (:phone, :otp_code, :purpose, :expires_at, :user_id)
                RETURNING id
                """),
                {
                    "phone": test_phone,
                    "otp_code": otp_code,
                    "purpose": "LOGIN",
                    "expires_at": expires_at,
                    "user_id": user_id
                }
            )
            await session.commit()
            
            print(f"   ✓ OTP generated: {otp_code}")
            print(f"     - Purpose: LOGIN")
            print(f"     - Expires: {expires_at}")
            
            # 3. Verify OTP
            print("\n3. Verifying OTP...")
            result = await session.execute(
                text("""
                SELECT id, verified 
                FROM otp_verifications 
                WHERE phone = :phone 
                AND otp_code = :otp_code 
                AND purpose = :purpose 
                AND expires_at > NOW() 
                AND verified = FALSE
                ORDER BY created_at DESC
                LIMIT 1
                """),
                {
                    "phone": test_phone,
                    "otp_code": otp_code,
                    "purpose": "LOGIN"
                }
            )
            otp_record = result.fetchone()
            
            if otp_record:
                await session.execute(
                    text("UPDATE otp_verifications SET verified = TRUE WHERE id = :id"),
                    {"id": otp_record[0]}
                )
                await session.commit()
                print(f"   ✓ OTP verified successfully")
            else:
                print(f"   ✗ OTP verification failed")
            
            # 4. Create refresh token
            print("\n4. Creating refresh token...")
            import secrets
            token = secrets.token_urlsafe(32)
            token_expires = datetime.utcnow() + timedelta(days=30)
            
            await session.execute(
                text("""
                INSERT INTO refresh_tokens (user_id, token, expires_at)
                VALUES (:user_id, :token, :expires_at)
                RETURNING id
                """),
                {
                    "user_id": user_id,
                    "token": token,
                    "expires_at": token_expires
                }
            )
            await session.commit()
            
            print(f"   ✓ Refresh token created")
            print(f"     - Token: {token[:20]}...")
            print(f"     - Expires: {token_expires}")
            
            # 5. Validate refresh token
            print("\n5. Validating refresh token...")
            result = await session.execute(
                text("""
                SELECT user_id, expires_at, revoked
                FROM refresh_tokens 
                WHERE token = :token 
                AND revoked = FALSE 
                AND expires_at > NOW()
                """),
                {"token": token}
            )
            token_record = result.fetchone()
            
            if token_record:
                print(f"   ✓ Token is valid")
                print(f"     - User ID: {token_record[0]}")
                print(f"     - Revoked: {token_record[2]}")
            else:
                print(f"   ✗ Token is invalid")
            
            # 6. Test cascade delete
            print("\n6. Testing cascade delete...")
            
            # Count related records before delete
            result = await session.execute(
                text("SELECT COUNT(*) FROM otp_verifications WHERE user_id = :user_id"),
                {"user_id": user_id}
            )
            otp_count_before = result.fetchone()[0]
            
            result = await session.execute(
                text("SELECT COUNT(*) FROM refresh_tokens WHERE user_id = :user_id"),
                {"user_id": user_id}
            )
            token_count_before = result.fetchone()[0]
            
            print(f"   Before delete:")
            print(f"     - OTP records: {otp_count_before}")
            print(f"     - Refresh tokens: {token_count_before}")
            
            # Delete user
            await session.execute(
                text("DELETE FROM users_auth WHERE id = :user_id"),
                {"user_id": user_id}
            )
            await session.commit()
            
            # Count related records after delete
            result = await session.execute(
                text("SELECT COUNT(*) FROM otp_verifications WHERE user_id = :user_id"),
                {"user_id": user_id}
            )
            otp_count_after = result.fetchone()[0]
            
            result = await session.execute(
                text("SELECT COUNT(*) FROM refresh_tokens WHERE user_id = :user_id"),
                {"user_id": user_id}
            )
            token_count_after = result.fetchone()[0]
            
            print(f"   After delete:")
            print(f"     - OTP records: {otp_count_after}")
            print(f"     - Refresh tokens: {token_count_after}")
            
            if otp_count_after == 0 and token_count_after == 0:
                print(f"   ✓ Cascade delete working correctly")
            else:
                print(f"   ✗ Cascade delete failed")
            
            print("\n" + "=" * 60)
            print("Demo completed successfully!")
            print("=" * 60)
            
        except Exception as e:
            print(f"\n❌ Error: {e}")
            import traceback
            traceback.print_exc()
            await session.rollback()


if __name__ == "__main__":
    asyncio.run(demo_auth_models())
