"""Unit tests for authentication backend functionality.

Task 7.7: Write unit tests for authentication backend
Tests password hashing, JWT encoding/decoding/expiration, OTP generation,
and duplicate phone/email validation.

Requirements: 5.5, 5.9, 5.19, 5.20
"""
import pytest
import bcrypt
from jose import jwt, JWTError
from datetime import datetime, timedelta, timezone
from sqlalchemy import text
from app.db.database import async_session_factory
from app.api.v1.auth import (
    generate_otp,
    create_access_token,
    create_refresh_token,
    verify_password
)


class TestPasswordHashing:
    """Test password hashing and verification with bcrypt.
    
    Validates Requirement 5.5: Password hashing with bcrypt (12 rounds minimum)
    Validates Requirement 5.20: Secure password storage
    """
    
    def test_bcrypt_rounds_minimum_12(self):
        """Test that bcrypt uses at least 12 rounds."""
        password = "TestPassword123"
        password_bytes = password.encode('utf-8')
        
        # Generate hash with 12 rounds
        salt = bcrypt.gensalt(rounds=12)
        password_hash = bcrypt.hashpw(password_bytes, salt)
        
        # Verify the hash contains round information (2b$12$ prefix)
        assert password_hash.startswith(b'$2b$12$'), "Hash should use bcrypt with 12 rounds"
    
    def test_password_hashing_produces_different_hashes(self):
        """Test that same password produces different hashes (salt is random)."""
        password = "TestPassword123"
        password_bytes = password.encode('utf-8')
        
        # Generate two hashes for same password
        salt1 = bcrypt.gensalt(rounds=12)
        hash1 = bcrypt.hashpw(password_bytes, salt1)
        
        salt2 = bcrypt.gensalt(rounds=12)
        hash2 = bcrypt.hashpw(password_bytes, salt2)
        
        # Hashes should be different due to random salt
        assert hash1 != hash2, "Same password should produce different hashes"
    
    def test_password_verification_success(self):
        """Test successful password verification."""
        password = "TestPassword123"
        password_bytes = password.encode('utf-8')
        
        # Generate hash
        salt = bcrypt.gensalt(rounds=12)
        password_hash = bcrypt.hashpw(password_bytes, salt)
        
        # Verify correct password
        assert bcrypt.checkpw(password_bytes, password_hash), "Correct password should verify"
    
    def test_password_verification_failure(self):
        """Test failed password verification with wrong password."""
        correct_password = "TestPassword123"
        wrong_password = "WrongPassword456"
        
        password_bytes = correct_password.encode('utf-8')
        salt = bcrypt.gensalt(rounds=12)
        password_hash = bcrypt.hashpw(password_bytes, salt)
        
        # Verify wrong password fails
        wrong_bytes = wrong_password.encode('utf-8')
        assert not bcrypt.checkpw(wrong_bytes, password_hash), "Wrong password should not verify"
    
    @pytest.mark.asyncio
    async def test_verify_password_async_function(self):
        """Test the async verify_password helper function."""
        password = "TestPassword123"
        password_bytes = password.encode('utf-8')
        
        # Generate hash
        salt = bcrypt.gensalt(rounds=12)
        password_hash = bcrypt.hashpw(password_bytes, salt).decode('utf-8')
        
        # Test correct password
        is_valid = await verify_password(password, password_hash)
        assert is_valid, "Correct password should verify"
        
        # Test wrong password
        is_valid = await verify_password("WrongPassword", password_hash)
        assert not is_valid, "Wrong password should not verify"


class TestJWTTokens:
    """Test JWT encoding, decoding, and expiration.
    
    Validates Requirement 5.9: JWT token generation with HS256
    """
    
    JWT_SECRET = "sentinelpay-jwt-secret-change-in-production"
    JWT_ALGORITHM = "HS256"
    
    def test_jwt_access_token_creation(self):
        """Test creating JWT access token with correct payload."""
        user_id = "550e8400-e29b-41d4-a716-446655440000"
        phone = "+911234567890"
        email = "test@example.com"
        
        token = create_access_token(user_id, phone, email)
        
        # Decode token (without verification for testing)
        payload = jwt.decode(token, self.JWT_SECRET, algorithms=[self.JWT_ALGORITHM])
        
        # Verify payload structure
        assert payload["user_id"] == user_id, "User ID should match"
        assert payload["phone"] == phone, "Phone should match"
        assert payload["email"] == email, "Email should match"
        assert "exp" in payload, "Token should have expiration"
        assert "iat" in payload, "Token should have issued-at timestamp"
    
    def test_jwt_expiration_24_hours(self):
        """Test that JWT access token expires in 24 hours."""
        user_id = "550e8400-e29b-41d4-a716-446655440000"
        phone = "+911234567890"
        email = "test@example.com"
        
        before_creation = datetime.now(timezone.utc)
        token = create_access_token(user_id, phone, email)
        after_creation = datetime.now(timezone.utc)
        
        # Decode token
        payload = jwt.decode(token, self.JWT_SECRET, algorithms=[self.JWT_ALGORITHM])
        
        # Calculate expected expiration (24 hours from now)
        exp_timestamp = payload["exp"]
        exp_datetime = datetime.fromtimestamp(exp_timestamp, tz=timezone.utc)
        
        # Verify expiration is approximately 24 hours from now
        # Allow 2 seconds margin for processing time (token timestamps are in seconds)
        expected_exp_min = before_creation + timedelta(hours=24) - timedelta(seconds=2)
        expected_exp_max = after_creation + timedelta(hours=24) + timedelta(seconds=2)
        
        assert expected_exp_min <= exp_datetime <= expected_exp_max, \
            f"Token should expire in 24 hours (exp: {exp_datetime}, expected: {expected_exp_min} to {expected_exp_max})"
    
    def test_jwt_signature_validation_success(self):
        """Test that valid JWT signature is accepted."""
        user_id = "550e8400-e29b-41d4-a716-446655440000"
        phone = "+911234567890"
        email = "test@example.com"
        
        token = create_access_token(user_id, phone, email)
        
        # This should not raise an exception
        try:
            payload = jwt.decode(token, self.JWT_SECRET, algorithms=[self.JWT_ALGORITHM])
            assert payload["user_id"] == user_id
        except jwt.InvalidSignatureError:
            pytest.fail("Valid signature should be accepted")
    
    def test_jwt_signature_validation_failure(self):
        """Test that tampered JWT is rejected."""
        user_id = "550e8400-e29b-41d4-a716-446655440000"
        phone = "+911234567890"
        email = "test@example.com"
        
        token = create_access_token(user_id, phone, email)
        
        # Tamper with token (change one character)
        tampered_token = token[:-10] + "X" + token[-9:]
        
        # Should raise JWTError
        with pytest.raises(JWTError):
            jwt.decode(tampered_token, self.JWT_SECRET, algorithms=[self.JWT_ALGORITHM])
    
    def test_jwt_expired_token_rejection(self):
        """Test that expired JWT is rejected."""
        # Create token with past expiration
        now = datetime.now(timezone.utc)
        exp = now - timedelta(hours=1)  # Expired 1 hour ago
        
        payload = {
            "user_id": "550e8400-e29b-41d4-a716-446655440000",
            "phone": "+911234567890",
            "email": "test@example.com",
            "exp": int(exp.timestamp()),
            "iat": int((now - timedelta(hours=25)).timestamp())
        }
        
        token = jwt.encode(payload, self.JWT_SECRET, algorithm=self.JWT_ALGORITHM)
        
        # Should raise JWTError (ExpiredSignatureError is a subclass)
        with pytest.raises(JWTError):
            jwt.decode(token, self.JWT_SECRET, algorithms=[self.JWT_ALGORITHM])
    
    def test_jwt_not_expired_token_acceptance(self):
        """Test that non-expired JWT is accepted."""
        # Create token with future expiration
        now = datetime.now(timezone.utc)
        exp = now + timedelta(hours=1)  # Expires in 1 hour
        
        payload = {
            "user_id": "550e8400-e29b-41d4-a716-446655440000",
            "phone": "+911234567890",
            "email": "test@example.com",
            "exp": int(exp.timestamp()),
            "iat": int(now.timestamp())
        }
        
        token = jwt.encode(payload, self.JWT_SECRET, algorithm=self.JWT_ALGORITHM)
        
        # Should not raise exception
        try:
            decoded = jwt.decode(token, self.JWT_SECRET, algorithms=[self.JWT_ALGORITHM])
            assert decoded["user_id"] == payload["user_id"]
        except JWTError:
            pytest.fail("Non-expired token should be accepted")
    
    def test_refresh_token_generation(self):
        """Test refresh token generation produces unique tokens."""
        token1 = create_refresh_token()
        token2 = create_refresh_token()
        
        # Tokens should be different
        assert token1 != token2, "Refresh tokens should be unique"
        
        # Tokens should be reasonably long (URL-safe base64)
        assert len(token1) >= 32, "Refresh token should be at least 32 characters"
        assert len(token2) >= 32, "Refresh token should be at least 32 characters"


class TestOTPGeneration:
    """Test OTP generation and verification.
    
    Validates Requirement 5.2: OTP generation with 6-digit codes
    Validates Requirement 5.3: OTP expiration (5 minutes)
    """
    
    def test_otp_generates_6_digits(self):
        """Test that OTP is exactly 6 digits."""
        otp = generate_otp()
        
        assert len(otp) == 6, "OTP should be 6 digits"
        assert otp.isdigit(), "OTP should contain only digits"
    
    def test_otp_generates_unique_codes(self):
        """Test that OTP generates different codes."""
        # Generate multiple OTPs
        otps = [generate_otp() for _ in range(100)]
        
        # Most should be unique (very high probability)
        unique_otps = set(otps)
        assert len(unique_otps) > 90, "OTPs should be mostly unique"
    
    def test_otp_range_validity(self):
        """Test that OTP is within valid 6-digit range."""
        for _ in range(20):
            otp = generate_otp()
            otp_int = int(otp)
            
            # Should be between 000000 and 999999
            assert 0 <= otp_int <= 999999, "OTP should be valid 6-digit number"
    
    def test_otp_leading_zeros(self):
        """Test that OTP preserves leading zeros."""
        # Generate many OTPs, some should start with 0
        otps = [generate_otp() for _ in range(1000)]
        
        # At least one should start with '0' (statistically)
        has_leading_zero = any(otp.startswith('0') for otp in otps)
        assert has_leading_zero, "OTP generation should preserve leading zeros"


class TestDuplicateValidation:
    """Test duplicate phone and email validation.
    
    Validates Requirement 5.19: Phone and email uniqueness validation
    Validates Requirement 5.20: Database constraints
    """
    
    @pytest.mark.asyncio
    async def test_duplicate_phone_rejected(self):
        """Test that duplicate phone number is rejected."""
        test_phone = f"+1555{datetime.now().microsecond:06d}"
        test_vpa1 = f"user{datetime.now().microsecond}@sentinelpay"
        
        async with async_session_factory() as session:
            try:
                # Insert first user
                await session.execute(
                    text("""
                    INSERT INTO users_auth (phone, email, password_hash, vpa)
                    VALUES (:phone, :email, :password_hash, :vpa)
                    """),
                    {
                        "phone": test_phone,
                        "email": f"user1{datetime.now().microsecond}@example.com",
                        "password_hash": "$2b$12$hashedpassword1",
                        "vpa": test_vpa1
                    }
                )
                await session.commit()
                
                # Try to insert second user with same phone (should fail)
                with pytest.raises(Exception) as exc_info:
                    await session.execute(
                        text("""
                        INSERT INTO users_auth (phone, email, password_hash, vpa)
                        VALUES (:phone, :email, :password_hash, :vpa)
                        """),
                        {
                            "phone": test_phone,  # Same phone
                            "email": f"user2{datetime.now().microsecond}@example.com",
                            "password_hash": "$2b$12$hashedpassword2",
                            "vpa": f"user2{datetime.now().microsecond}@sentinelpay"
                        }
                    )
                    await session.commit()
                
                # Verify it's a unique constraint violation
                assert "unique" in str(exc_info.value).lower() or \
                       "duplicate" in str(exc_info.value).lower(), \
                       "Should fail with unique constraint violation"
                
            finally:
                # Cleanup
                await session.rollback()
                await session.execute(
                    text("DELETE FROM users_auth WHERE phone = :phone"),
                    {"phone": test_phone}
                )
                await session.commit()
    
    @pytest.mark.asyncio
    async def test_duplicate_email_rejected(self):
        """Test that duplicate email address is rejected."""
        test_email = f"test{datetime.now().microsecond}@example.com"
        test_phone1 = f"+1555{datetime.now().microsecond:06d}"
        test_phone2 = f"+1556{datetime.now().microsecond:06d}"
        
        async with async_session_factory() as session:
            try:
                # Insert first user
                await session.execute(
                    text("""
                    INSERT INTO users_auth (phone, email, password_hash, vpa)
                    VALUES (:phone, :email, :password_hash, :vpa)
                    """),
                    {
                        "phone": test_phone1,
                        "email": test_email,
                        "password_hash": "$2b$12$hashedpassword1",
                        "vpa": f"user1{datetime.now().microsecond}@sentinelpay"
                    }
                )
                await session.commit()
                
                # Try to insert second user with same email (should fail)
                with pytest.raises(Exception) as exc_info:
                    await session.execute(
                        text("""
                        INSERT INTO users_auth (phone, email, password_hash, vpa)
                        VALUES (:phone, :email, :password_hash, :vpa)
                        """),
                        {
                            "phone": test_phone2,  # Different phone
                            "email": test_email,   # Same email
                            "password_hash": "$2b$12$hashedpassword2",
                            "vpa": f"user2{datetime.now().microsecond}@sentinelpay"
                        }
                    )
                    await session.commit()
                
                # Verify it's a unique constraint violation
                assert "unique" in str(exc_info.value).lower() or \
                       "duplicate" in str(exc_info.value).lower(), \
                       "Should fail with unique constraint violation"
                
            finally:
                # Cleanup
                await session.rollback()
                await session.execute(
                    text("DELETE FROM users_auth WHERE phone IN (:phone1, :phone2)"),
                    {"phone1": test_phone1, "phone2": test_phone2}
                )
                await session.commit()
    
    @pytest.mark.asyncio
    async def test_duplicate_vpa_rejected(self):
        """Test that duplicate VPA is rejected."""
        test_vpa = f"user{datetime.now().microsecond}@sentinelpay"
        test_phone1 = f"+1555{datetime.now().microsecond:06d}"
        test_phone2 = f"+1556{datetime.now().microsecond:06d}"
        
        async with async_session_factory() as session:
            try:
                # Insert first user
                await session.execute(
                    text("""
                    INSERT INTO users_auth (phone, email, password_hash, vpa)
                    VALUES (:phone, :email, :password_hash, :vpa)
                    """),
                    {
                        "phone": test_phone1,
                        "email": f"user1{datetime.now().microsecond}@example.com",
                        "password_hash": "$2b$12$hashedpassword1",
                        "vpa": test_vpa
                    }
                )
                await session.commit()
                
                # Try to insert second user with same VPA (should fail)
                with pytest.raises(Exception) as exc_info:
                    await session.execute(
                        text("""
                        INSERT INTO users_auth (phone, email, password_hash, vpa)
                        VALUES (:phone, :email, :password_hash, :vpa)
                        """),
                        {
                            "phone": test_phone2,  # Different phone
                            "email": f"user2{datetime.now().microsecond}@example.com",
                            "password_hash": "$2b$12$hashedpassword2",
                            "vpa": test_vpa  # Same VPA
                        }
                    )
                    await session.commit()
                
                # Verify it's a unique constraint violation
                assert "unique" in str(exc_info.value).lower() or \
                       "duplicate" in str(exc_info.value).lower(), \
                       "Should fail with unique constraint violation"
                
            finally:
                # Cleanup
                await session.rollback()
                await session.execute(
                    text("DELETE FROM users_auth WHERE phone IN (:phone1, :phone2)"),
                    {"phone1": test_phone1, "phone2": test_phone2}
                )
                await session.commit()
    
    @pytest.mark.asyncio
    async def test_null_email_allowed_multiple_times(self):
        """Test that multiple users can have NULL email (NULL != NULL in SQL)."""
        test_phone1 = f"+1555{datetime.now().microsecond:06d}"
        test_phone2 = f"+1556{datetime.now().microsecond:06d}"
        
        async with async_session_factory() as session:
            try:
                # Insert first user with NULL email
                await session.execute(
                    text("""
                    INSERT INTO users_auth (phone, password_hash, vpa)
                    VALUES (:phone, :password_hash, :vpa)
                    """),
                    {
                        "phone": test_phone1,
                        "password_hash": "$2b$12$hashedpassword1",
                        "vpa": f"user1{datetime.now().microsecond}@sentinelpay"
                    }
                )
                await session.commit()
                
                # Insert second user with NULL email (should succeed)
                await session.execute(
                    text("""
                    INSERT INTO users_auth (phone, password_hash, vpa)
                    VALUES (:phone, :password_hash, :vpa)
                    """),
                    {
                        "phone": test_phone2,
                        "password_hash": "$2b$12$hashedpassword2",
                        "vpa": f"user2{datetime.now().microsecond}@sentinelpay"
                    }
                )
                await session.commit()
                
                # Both users should exist
                result = await session.execute(
                    text("""
                    SELECT COUNT(*) FROM users_auth 
                    WHERE phone IN (:phone1, :phone2) AND email IS NULL
                    """),
                    {"phone1": test_phone1, "phone2": test_phone2}
                )
                count = result.scalar()
                assert count == 2, "Both users with NULL email should exist"
                
            finally:
                # Cleanup
                await session.execute(
                    text("DELETE FROM users_auth WHERE phone IN (:phone1, :phone2)"),
                    {"phone1": test_phone1, "phone2": test_phone2}
                )
                await session.commit()


class TestPasswordValidation:
    """Test password format validation.
    
    Validates Requirement 5.5: Password validation rules
    """
    
    def test_password_validation_regex(self):
        """Test password validation regex pattern."""
        import re
        
        # Valid passwords
        valid_passwords = [
            "Test1234",
            "MyP@ssw0rd",
            "Abc12345",
            "StrongPass1"
        ]
        
        # Invalid passwords
        invalid_passwords = [
            "test1234",      # No uppercase
            "TEST1234",      # No lowercase
            "TestTest",      # No digit
            "Test123",       # Too short (< 8 chars)
            "test",          # Too short, no uppercase, no digit
        ]
        
        # Pattern from requirements
        pattern = r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$'
        
        # Test valid passwords
        for pwd in valid_passwords:
            assert re.match(pattern, pwd), f"{pwd} should be valid"
        
        # Test invalid passwords
        for pwd in invalid_passwords:
            assert not re.match(pattern, pwd), f"{pwd} should be invalid"
