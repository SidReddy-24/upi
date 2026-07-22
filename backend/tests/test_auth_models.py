"""Unit tests for authentication database models.

Tests the SQLAlchemy ORM models for users, OTP verifications, and refresh tokens.
Validates Requirements 5.1, 5.19, 5.20.
"""
import pytest
from datetime import datetime, timedelta
from sqlalchemy import text
from app.db.database import async_session_factory


class TestAuthTables:
    """Test authentication database tables structure and constraints."""
    
    @pytest.mark.asyncio
    async def test_users_auth_table_exists(self):
        """Verify users_auth table was created successfully."""
        async with async_session_factory() as session:
            result = await session.execute(
                text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'users_auth'
                """)
            )
            tables = result.fetchall()
            assert len(tables) == 1, "users_auth table should exist"
    
    @pytest.mark.asyncio
    async def test_otp_verifications_table_exists(self):
        """Verify otp_verifications table was created successfully."""
        async with async_session_factory() as session:
            result = await session.execute(
                text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'otp_verifications'
                """)
            )
            tables = result.fetchall()
            assert len(tables) == 1, "otp_verifications table should exist"
    
    @pytest.mark.asyncio
    async def test_refresh_tokens_table_exists(self):
        """Verify refresh_tokens table was created successfully."""
        async with async_session_factory() as session:
            result = await session.execute(
                text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'refresh_tokens'
                """)
            )
            tables = result.fetchall()
            assert len(tables) == 1, "refresh_tokens table should exist"
    
    @pytest.mark.asyncio
    async def test_users_auth_unique_constraints(self):
        """Test that phone, email, and VPA have unique constraints."""
        async with async_session_factory() as session:
            result = await session.execute(
                text("""
                SELECT constraint_name 
                FROM information_schema.table_constraints 
                WHERE table_name = 'users_auth' 
                AND constraint_type = 'UNIQUE'
                """)
            )
            constraints = [row[0] for row in result.fetchall()]
            
            assert 'users_auth_phone_key' in constraints, "Phone should be unique"
            assert 'users_auth_email_key' in constraints, "Email should be unique"
            assert 'users_auth_vpa_key' in constraints, "VPA should be unique"
    
    @pytest.mark.asyncio
    async def test_insert_and_retrieve_user(self):
        """Test inserting and retrieving a user record."""
        test_phone = f"+1234567890{datetime.now().microsecond}"
        test_vpa = f"testuser{datetime.now().microsecond}@okhdfc"
        
        async with async_session_factory() as session:
            # Insert test user
            await session.execute(
                text("""
                INSERT INTO users_auth (phone, email, password_hash, vpa)
                VALUES (:phone, :email, :password_hash, :vpa)
                """),
                {
                    "phone": test_phone,
                    "email": f"test{datetime.now().microsecond}@example.com",
                    "password_hash": "$2b$12$hashedpassword",
                    "vpa": test_vpa
                }
            )
            await session.commit()
            
            # Retrieve user
            result = await session.execute(
                text("SELECT phone, vpa FROM users_auth WHERE phone = :phone"),
                {"phone": test_phone}
            )
            user = result.fetchone()
            
            assert user is not None, "User should be inserted"
            assert user[0] == test_phone, "Phone should match"
            assert user[1] == test_vpa, "VPA should match"
            
            # Cleanup
            await session.execute(
                text("DELETE FROM users_auth WHERE phone = :phone"),
                {"phone": test_phone}
            )
            await session.commit()
    
    @pytest.mark.asyncio
    async def test_otp_verification_insert(self):
        """Test inserting and retrieving OTP verification records."""
        test_phone = f"+1234567890{datetime.now().microsecond}"
        
        async with async_session_factory() as session:
            # Insert OTP
            await session.execute(
                text("""
                INSERT INTO otp_verifications (phone, otp_code, purpose, expires_at)
                VALUES (:phone, :otp_code, :purpose, :expires_at)
                """),
                {
                    "phone": test_phone,
                    "otp_code": "123456",
                    "purpose": "REGISTRATION",
                    "expires_at": datetime.utcnow() + timedelta(minutes=5)
                }
            )
            await session.commit()
            
            # Retrieve OTP
            result = await session.execute(
                text("""
                SELECT phone, otp_code, purpose, verified 
                FROM otp_verifications 
                WHERE phone = :phone
                """),
                {"phone": test_phone}
            )
            otp = result.fetchone()
            
            assert otp is not None, "OTP should be inserted"
            assert otp[1] == "123456", "OTP code should match"
            assert otp[2] == "REGISTRATION", "Purpose should match"
            assert otp[3] is False, "Verified should default to False"
            
            # Cleanup
            await session.execute(
                text("DELETE FROM otp_verifications WHERE phone = :phone"),
                {"phone": test_phone}
            )
            await session.commit()
    
    @pytest.mark.asyncio
    async def test_foreign_key_cascade_delete(self):
        """Test that deleting a user cascades to related records."""
        test_phone = f"+1234567890{datetime.now().microsecond}"
        test_vpa = f"testuser{datetime.now().microsecond}@okhdfc"
        
        async with async_session_factory() as session:
            # Insert user
            result = await session.execute(
                text("""
                INSERT INTO users_auth (phone, email, password_hash, vpa)
                VALUES (:phone, :email, :password_hash, :vpa)
                RETURNING id
                """),
                {
                    "phone": test_phone,
                    "email": f"test{datetime.now().microsecond}@example.com",
                    "password_hash": "$2b$12$hashedpassword",
                    "vpa": test_vpa
                }
            )
            user_id = result.fetchone()[0]
            await session.commit()
            
            # Insert refresh token
            await session.execute(
                text("""
                INSERT INTO refresh_tokens (user_id, token, expires_at)
                VALUES (:user_id, :token, :expires_at)
                """),
                {
                    "user_id": user_id,
                    "token": f"token_{datetime.now().microsecond}",
                    "expires_at": datetime.utcnow() + timedelta(days=30)
                }
            )
            await session.commit()
            
            # Delete user (should cascade to refresh_tokens)
            await session.execute(
                text("DELETE FROM users_auth WHERE id = :user_id"),
                {"user_id": user_id}
            )
            await session.commit()
            
            # Verify refresh token was deleted
            result = await session.execute(
                text("SELECT COUNT(*) FROM refresh_tokens WHERE user_id = :user_id"),
                {"user_id": user_id}
            )
            count = result.fetchone()[0]
            assert count == 0, "Refresh tokens should be deleted on user deletion"
    
    @pytest.mark.asyncio
    async def test_check_constraints(self):
        """Test that check constraints are enforced."""
        async with async_session_factory() as session:
            # Test invalid OTP purpose
            with pytest.raises(Exception):
                await session.execute(
                    text("""
                    INSERT INTO otp_verifications (phone, otp_code, purpose, expires_at)
                    VALUES (:phone, :otp_code, :purpose, :expires_at)
                    """),
                    {
                        "phone": "+1234567890",
                        "otp_code": "123456",
                        "purpose": "INVALID_PURPOSE",
                        "expires_at": datetime.utcnow() + timedelta(minutes=5)
                    }
                )
                await session.commit()
            await session.rollback()
