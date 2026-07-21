"""Authentication endpoints for JWT-based auth with OTP verification.

This module provides:
- OTP generation and verification for registration, password reset, and login
- User registration with phone/email and password
- Login endpoints with JWT token generation
- Token refresh and logout functionality

Requirements: 5.1, 5.2, 5.3, 5.15, 5.16
"""
import logging
import secrets
from datetime import datetime, timedelta
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db_session

logger = logging.getLogger("fraudshield.auth")

router = APIRouter(prefix="/auth")


# ============================================================================
# Request/Response Models
# ============================================================================

class SendOtpRequest(BaseModel):
    """Request model for OTP generation."""
    phone: str = Field(..., min_length=10, max_length=15, description="User phone number")
    purpose: Literal["REGISTRATION", "PASSWORD_RESET", "LOGIN"] = Field(
        ..., description="Purpose of OTP verification"
    )
    
    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        """Validate phone number format."""
        # Remove any non-digit characters
        cleaned = "".join(c for c in v if c.isdigit())
        if len(cleaned) < 10:
            raise ValueError("Phone number must contain at least 10 digits")
        return cleaned


class SendOtpResponse(BaseModel):
    """Response model for OTP generation."""
    success: bool
    message: str
    expires_in_seconds: int = 300  # 5 minutes


class VerifyOtpRequest(BaseModel):
    """Request model for OTP verification."""
    phone: str = Field(..., min_length=10, max_length=15, description="User phone number")
    otp_code: str = Field(..., min_length=6, max_length=6, description="6-digit OTP code")
    purpose: Literal["REGISTRATION", "PASSWORD_RESET", "LOGIN"] = Field(
        ..., description="Purpose of OTP verification"
    )
    
    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        """Validate phone number format."""
        cleaned = "".join(c for c in v if c.isdigit())
        if len(cleaned) < 10:
            raise ValueError("Phone number must contain at least 10 digits")
        return cleaned
    
    @field_validator("otp_code")
    @classmethod
    def validate_otp_code(cls, v: str) -> str:
        """Validate OTP code format."""
        if not v.isdigit():
            raise ValueError("OTP code must contain only digits")
        if len(v) != 6:
            raise ValueError("OTP code must be exactly 6 digits")
        return v


class VerifyOtpResponse(BaseModel):
    """Response model for OTP verification."""
    success: bool
    message: str
    verified: bool


# ============================================================================
# Helper Functions
# ============================================================================

def generate_otp() -> str:
    """Generate a secure 6-digit OTP code.
    
    Returns:
        str: 6-digit OTP code as string
    """
    # Generate a random 6-digit number
    return f"{secrets.randbelow(1000000):06d}"


async def invalidate_previous_otps(
    db: AsyncSession,
    phone: str,
    purpose: str
) -> None:
    """Mark all previous unverified OTPs for this phone/purpose as verified.
    
    This ensures only the most recent OTP is valid.
    
    Args:
        db: Database session
        phone: User phone number
        purpose: OTP purpose (REGISTRATION, PASSWORD_RESET, LOGIN)
    """
    await db.execute(
        text("""
            UPDATE otp_verifications 
            SET verified = TRUE 
            WHERE phone = :phone 
            AND purpose = :purpose 
            AND verified = FALSE
        """),
        {"phone": phone, "purpose": purpose}
    )
    await db.commit()


# ============================================================================
# Endpoints
# ============================================================================

@router.post("/send-otp", response_model=SendOtpResponse, status_code=status.HTTP_200_OK)
async def send_otp(
    request: SendOtpRequest,
    db: AsyncSession = Depends(get_db_session)
):
    """Generate and send OTP for registration or password reset.
    
    This endpoint:
    1. Generates a secure 6-digit OTP
    2. Stores it in the database with 5-minute expiration
    3. Logs the OTP to console for demo purposes (no real SMS)
    4. Invalidates any previous unverified OTPs for the same phone/purpose
    
    Requirements: 5.2, 5.3, 5.15
    
    Args:
        request: OTP request containing phone and purpose
        db: Database session
        
    Returns:
        SendOtpResponse with success status and expiration time
    """
    try:
        # Invalidate previous OTPs
        await invalidate_previous_otps(db, request.phone, request.purpose)
        
        # Generate OTP
        otp_code = generate_otp()
        
        # Set expiration (5 minutes from now)
        expires_at = datetime.utcnow() + timedelta(minutes=5)
        
        # Create OTP verification record
        await db.execute(
            text("""
                INSERT INTO otp_verifications (phone, otp_code, purpose, expires_at, verified)
                VALUES (:phone, :otp_code, :purpose, :expires_at, FALSE)
            """),
            {
                "phone": request.phone,
                "otp_code": otp_code,
                "purpose": request.purpose,
                "expires_at": expires_at
            }
        )
        await db.commit()
        
        # Log OTP to console for demo purposes (in production, send via SMS)
        logger.info(
            f"OTP Generated | Phone: {request.phone} | Purpose: {request.purpose} | "
            f"Code: {otp_code} | Expires: {expires_at.isoformat()}"
        )
        
        # Print to console for easy visibility during demo
        print(f"\n{'='*60}")
        print(f"🔐 OTP CODE FOR {request.phone}")
        print(f"{'='*60}")
        print(f"Code:    {otp_code}")
        print(f"Purpose: {request.purpose}")
        print(f"Expires: {expires_at.strftime('%Y-%m-%d %H:%M:%S UTC')}")
        print(f"{'='*60}\n")
        
        return SendOtpResponse(
            success=True,
            message=f"OTP sent successfully to {request.phone}",
            expires_in_seconds=300
        )
        
    except Exception as e:
        logger.error(f"Error sending OTP: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send OTP. Please try again."
        )


@router.post("/verify-otp", response_model=VerifyOtpResponse, status_code=status.HTTP_200_OK)
async def verify_otp(
    request: VerifyOtpRequest,
    db: AsyncSession = Depends(get_db_session)
):
    """Verify OTP code for phone number and purpose.
    
    This endpoint:
    1. Checks if OTP exists for the given phone/purpose combination
    2. Validates OTP is not expired (5-minute window)
    3. Validates OTP has not been used (verified=False)
    4. Marks OTP as verified if valid
    
    Requirements: 5.2, 5.3, 5.15
    
    Args:
        request: Verification request containing phone, OTP code, and purpose
        db: Database session
        
    Returns:
        VerifyOtpResponse with verification status
        
    Raises:
        HTTPException: If OTP is invalid, expired, or already used
    """
    try:
        # Find the most recent unverified OTP for this phone/purpose
        result = await db.execute(
            text("""
                SELECT id, phone, otp_code, purpose, expires_at, verified, created_at
                FROM otp_verifications
                WHERE phone = :phone
                AND purpose = :purpose
                AND verified = FALSE
                ORDER BY created_at DESC
                LIMIT 1
            """),
            {"phone": request.phone, "purpose": request.purpose}
        )
        otp_record = result.first()
        
        print(f"DEBUG: Query result: {otp_record}")
        
        # Check if OTP exists
        if not otp_record:
            logger.warning(
                f"OTP verification failed | Phone: {request.phone} | "
                f"Purpose: {request.purpose} | Reason: No OTP found"
            )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No OTP found for this phone number and purpose. Please request a new OTP."
            )
        
        # Extract fields from the row
        otp_id, phone, otp_code, purpose, expires_at, verified, created_at = otp_record
        
        # Check if OTP is expired (make sure both datetimes are timezone-aware)
        current_time = datetime.utcnow()
        # If expires_at is timezone-aware, make current_time timezone-aware too
        if expires_at.tzinfo is not None:
            from datetime import timezone as dt_timezone
            current_time = datetime.now(dt_timezone.utc)
        
        if current_time > expires_at:
            logger.warning(
                f"OTP verification failed | Phone: {request.phone} | "
                f"Purpose: {request.purpose} | Reason: OTP expired"
            )
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail="OTP has expired. Please request a new OTP."
            )
        
        # Check if OTP code matches
        if otp_code != request.otp_code:
            logger.warning(
                f"OTP verification failed | Phone: {request.phone} | "
                f"Purpose: {request.purpose} | Reason: Invalid code"
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid OTP code. Please check and try again."
            )
        
        # Mark OTP as verified
        await db.execute(
            text("""
                UPDATE otp_verifications
                SET verified = TRUE
                WHERE id = :otp_id
            """),
            {"otp_id": otp_id}
        )
        await db.commit()
        
        logger.info(
            f"OTP verified successfully | Phone: {request.phone} | "
            f"Purpose: {request.purpose}"
        )
        
        return VerifyOtpResponse(
            success=True,
            message="OTP verified successfully",
            verified=True
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Error verifying OTP: {str(e)}", exc_info=True)
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to verify OTP. Please try again."
        )


# ============================================================================
# Task 7.3: User Registration Endpoint
# ============================================================================

class RegisterRequest(BaseModel):
    """Request model for user registration."""
    phone: str = Field(..., min_length=10, max_length=15, description="User phone number")
    password: str = Field(..., min_length=8, max_length=100, description="User password")
    email: str | None = Field(None, description="User email address (optional)")
    
    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        """Validate phone number format."""
        cleaned = "".join(c for c in v if c.isdigit())
        if len(cleaned) < 10:
            raise ValueError("Phone number must contain at least 10 digits")
        return cleaned
    
    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        """Validate password format (min 8 chars, uppercase, lowercase, digit)."""
        import re
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        if not re.search(r'[a-z]', v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r'[A-Z]', v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r'\d', v):
            raise ValueError("Password must contain at least one digit")
        return v


class UserResponse(BaseModel):
    """Response model for user data."""
    id: str
    phone: str
    email: str | None
    vpa: str
    created_at: str


class RegisterResponse(BaseModel):
    """Response model for registration."""
    success: bool
    message: str
    user: UserResponse


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
async def register(
    request: RegisterRequest,
    db: AsyncSession = Depends(get_db_session)
):
    """Register a new user with phone, password, and optional email.
    
    This endpoint:
    1. Validates password format (min 8 chars, uppercase, lowercase, digit)
    2. Checks for duplicate phone/email
    3. Hashes password with bcrypt (12 rounds minimum)
    4. Creates user record with auto-generated VPA
    
    Requirements: 5.1, 5.4, 5.5, 5.19, 5.20
    
    Args:
        request: Registration request with phone, password, and optional email
        db: Database session
        
    Returns:
        RegisterResponse with user profile
        
    Raises:
        HTTPException: If phone/email already exists or validation fails
    """
    try:
        import bcrypt
        
        # Check if phone already exists
        result = await db.execute(
            text("SELECT id FROM users_auth WHERE phone = :phone"),
            {"phone": request.phone}
        )
        if result.first():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Phone number already registered"
            )
        
        # Check if email already exists (if provided)
        if request.email:
            result = await db.execute(
                text("SELECT id FROM users_auth WHERE email = :email"),
                {"email": request.email}
            )
            if result.first():
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Email address already registered"
                )
        
        # Hash password with bcrypt (12 rounds)
        password_bytes = request.password.encode('utf-8')
        salt = bcrypt.gensalt(rounds=12)
        password_hash = bcrypt.hashpw(password_bytes, salt).decode('utf-8')
        
        # Generate VPA (format: phoneXXXXXX@sentinelpay)
        vpa = f"phone{request.phone[-6:]}@sentinelpay"
        
        # Check if VPA already exists (should be unique)
        result = await db.execute(
            text("SELECT id FROM users_auth WHERE vpa = :vpa"),
            {"vpa": vpa}
        )
        if result.first():
            # Add random suffix if collision
            import random
            vpa = f"phone{request.phone[-6:]}{random.randint(100,999)}@sentinelpay"
        
        # Create user record
        result = await db.execute(
            text("""
                INSERT INTO users_auth (phone, email, password_hash, vpa)
                VALUES (:phone, :email, :password_hash, :vpa)
                RETURNING id, phone, email, vpa, created_at
            """),
            {
                "phone": request.phone,
                "email": request.email,
                "password_hash": password_hash,
                "vpa": vpa
            }
        )
        user_record = result.first()
        await db.commit()
        
        logger.info(f"User registered successfully | Phone: {request.phone} | VPA: {vpa}")
        
        return RegisterResponse(
            success=True,
            message="User registered successfully",
            user=UserResponse(
                id=str(user_record[0]),
                phone=user_record[1],
                email=user_record[2],
                vpa=user_record[3],
                created_at=user_record[4].isoformat()
            )
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error during registration: {str(e)}", exc_info=True)
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to register user. Please try again."
        )



# ============================================================================
# Task 7.4: Login Endpoints & Task 7.5: JWT Token Management
# ============================================================================

class LoginRequest(BaseModel):
    """Request model for user login."""
    identifier: str = Field(..., description="Phone number or email")
    password: str = Field(..., min_length=8, max_length=100, description="User password")


class AuthTokens(BaseModel):
    """Response model for authentication tokens."""
    access_token: str
    refresh_token: str
    expires_in: int  # seconds
    token_type: str = "Bearer"


class LoginResponse(BaseModel):
    """Response model for login."""
    success: bool
    message: str
    user: UserResponse
    tokens: AuthTokens


def create_access_token(user_id: str, phone: str, email: str | None) -> str:
    """Create JWT access token with 24-hour expiration.
    
    Requirements: 5.9
    
    Args:
        user_id: User ID
        phone: User phone number
        email: User email (optional)
        
    Returns:
        JWT access token string
    """
    import jwt
    from datetime import timezone
    
    # Get JWT secret from config (use environment variable in production)
    JWT_SECRET = "sentinelpay-jwt-secret-change-in-production"  # TODO: Move to env
    JWT_ALGORITHM = "HS256"
    
    # Create payload
    now = datetime.now(timezone.utc)
    exp = now + timedelta(hours=24)  # 24-hour expiration
    
    payload = {
        "user_id": user_id,
        "phone": phone,
        "email": email,
        "exp": int(exp.timestamp()),
        "iat": int(now.timestamp())
    }
    
    # Encode JWT
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return token


def create_refresh_token() -> str:
    """Create random refresh token.
    
    Requirements: 5.9
    
    Returns:
        Random refresh token string
    """
    return secrets.token_urlsafe(32)


async def verify_password(password: str, password_hash: str) -> bool:
    """Verify password against bcrypt hash.
    
    Args:
        password: Plain text password
        password_hash: bcrypt password hash
        
    Returns:
        True if password matches, False otherwise
    """
    import bcrypt
    
    password_bytes = password.encode('utf-8')
    hash_bytes = password_hash.encode('utf-8')
    
    return bcrypt.checkpw(password_bytes, hash_bytes)


@router.post("/login", response_model=LoginResponse, status_code=status.HTTP_200_OK)
async def login(
    request: LoginRequest,
    db: AsyncSession = Depends(get_db_session)
):
    """Login with phone/email and password, returning JWT tokens.
    
    This endpoint:
    1. Finds user by phone or email
    2. Verifies password with bcrypt
    3. Generates JWT access token (24h expiration)
    4. Generates refresh token (30d expiration)
    5. Updates last_login timestamp
    
    Requirements: 5.6, 5.7, 5.9, 5.10
    
    Args:
        request: Login request with identifier (phone/email) and password
        db: Database session
        
    Returns:
        LoginResponse with user profile and tokens
        
    Raises:
        HTTPException: If credentials are invalid
    """
    try:
        # Find user by phone or email
        result = await db.execute(
            text("""
                SELECT id, phone, email, password_hash, vpa, created_at
                FROM users_auth
                WHERE phone = :identifier OR email = :identifier
                LIMIT 1
            """),
            {"identifier": request.identifier}
        )
        user_record = result.first()
        
        # Check if user exists
        if not user_record:
            logger.warning(f"Login failed | Identifier: {request.identifier} | Reason: User not found")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )
        
        user_id, phone, email, password_hash, vpa, created_at = user_record
        
        # Verify password
        password_valid = await verify_password(request.password, password_hash)
        if not password_valid:
            logger.warning(f"Login failed | Identifier: {request.identifier} | Reason: Invalid password")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )
        
        # Create JWT access token
        access_token = create_access_token(str(user_id), phone, email)
        
        # Create refresh token
        refresh_token = create_refresh_token()
        
        # Store refresh token in database with 30-day expiration
        expires_at = datetime.utcnow() + timedelta(days=30)
        await db.execute(
            text("""
                INSERT INTO refresh_tokens (user_id, token, expires_at, revoked)
                VALUES (:user_id, :token, :expires_at, FALSE)
            """),
            {
                "user_id": user_id,
                "token": refresh_token,
                "expires_at": expires_at
            }
        )
        
        # Update last_login timestamp
        await db.execute(
            text("""
                UPDATE users_auth
                SET last_login = NOW()
                WHERE id = :user_id
            """),
            {"user_id": user_id}
        )
        
        await db.commit()
        
        logger.info(f"Login successful | User: {phone} | VPA: {vpa}")
        
        return LoginResponse(
            success=True,
            message="Login successful",
            user=UserResponse(
                id=str(user_id),
                phone=phone,
                email=email,
                vpa=vpa,
                created_at=created_at.isoformat()
            ),
            tokens=AuthTokens(
                access_token=access_token,
                refresh_token=refresh_token,
                expires_in=86400,  # 24 hours in seconds
                token_type="Bearer"
            )
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error during login: {str(e)}", exc_info=True)
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to login. Please try again."
        )


class RefreshRequest(BaseModel):
    """Request model for token refresh."""
    refresh_token: str = Field(..., description="Refresh token")


class RefreshResponse(BaseModel):
    """Response model for token refresh."""
    success: bool
    message: str
    tokens: AuthTokens


@router.post("/refresh", response_model=RefreshResponse, status_code=status.HTTP_200_OK)
async def refresh_token(
    request: RefreshRequest,
    db: AsyncSession = Depends(get_db_session)
):
    """Refresh JWT access token using refresh token.
    
    This endpoint:
    1. Validates refresh token exists and is not revoked
    2. Checks refresh token is not expired
    3. Generates new JWT access token
    4. Optionally rotates refresh token
    
    Requirements: 5.13
    
    Args:
        request: Refresh request with refresh token
        db: Database session
        
    Returns:
        RefreshResponse with new tokens
        
    Raises:
        HTTPException: If refresh token is invalid, expired, or revoked
    """
    try:
        # Find refresh token in database
        result = await db.execute(
            text("""
                SELECT rt.id, rt.user_id, rt.expires_at, rt.revoked, 
                       u.phone, u.email
                FROM refresh_tokens rt
                JOIN users_auth u ON rt.user_id = u.id
                WHERE rt.token = :token
                LIMIT 1
            """),
            {"token": request.refresh_token}
        )
        token_record = result.first()
        
        # Check if token exists
        if not token_record:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )
        
        token_id, user_id, expires_at, revoked, phone, email = token_record
        
        # Check if token is revoked
        if revoked:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token has been revoked"
            )
        
        # Check if token is expired
        from datetime import timezone
        current_time = datetime.now(timezone.utc)
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        
        if current_time > expires_at:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token has expired"
            )
        
        # Create new JWT access token
        access_token = create_access_token(str(user_id), phone, email)
        
        # Keep same refresh token (or rotate if desired)
        # For security, we could generate a new refresh token and revoke the old one
        
        logger.info(f"Token refreshed | User: {phone}")
        
        return RefreshResponse(
            success=True,
            message="Token refreshed successfully",
            tokens=AuthTokens(
                access_token=access_token,
                refresh_token=request.refresh_token,  # Return same refresh token
                expires_in=86400,
                token_type="Bearer"
            )
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error refreshing token: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to refresh token. Please try again."
        )


class LogoutRequest(BaseModel):
    """Request model for logout."""
    refresh_token: str = Field(..., description="Refresh token to revoke")


class LogoutResponse(BaseModel):
    """Response model for logout."""
    success: bool
    message: str


@router.post("/logout", response_model=LogoutResponse, status_code=status.HTTP_200_OK)
async def logout(
    request: LogoutRequest,
    db: AsyncSession = Depends(get_db_session)
):
    """Logout by revoking refresh token.
    
    This endpoint:
    1. Finds refresh token in database
    2. Marks it as revoked
    
    Requirements: 5.14
    
    Args:
        request: Logout request with refresh token
        db: Database session
        
    Returns:
        LogoutResponse with success status
    """
    try:
        # Revoke refresh token
        await db.execute(
            text("""
                UPDATE refresh_tokens
                SET revoked = TRUE
                WHERE token = :token
            """),
            {"token": request.refresh_token}
        )
        await db.commit()
        
        logger.info("User logged out successfully")
        
        return LogoutResponse(
            success=True,
            message="Logged out successfully"
        )
        
    except Exception as e:
        logger.error(f"Error during logout: {str(e)}", exc_info=True)
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to logout. Please try again."
        )


# ============================================================================
# Task 7.6: Password Reset Endpoint
# ============================================================================

class ResetPasswordRequest(BaseModel):
    """Request model for password reset."""
    phone: str = Field(..., min_length=10, max_length=15, description="User phone number")
    otp_code: str = Field(..., min_length=6, maxLength=6, description="Verified OTP code")
    new_password: str = Field(..., min_length=8, max_length=100, description="New password")
    
    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        """Validate phone number format."""
        cleaned = "".join(c for c in v if c.isdigit())
        if len(cleaned) < 10:
            raise ValueError("Phone number must contain at least 10 digits")
        return cleaned
    
    @field_validator("new_password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        """Validate password format (min 8 chars, uppercase, lowercase, digit)."""
        import re
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        if not re.search(r'[a-z]', v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r'[A-Z]', v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r'\d', v):
            raise ValueError("Password must contain at least one digit")
        return v


class ResetPasswordResponse(BaseModel):
    """Response model for password reset."""
    success: bool
    message: str


@router.post("/reset-password", response_model=ResetPasswordResponse, status_code=status.HTTP_200_OK)
async def reset_password(
    request: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db_session)
):
    """Reset user password after OTP verification.
    
    This endpoint:
    1. Verifies OTP for PASSWORD_RESET purpose
    2. Finds user by phone number
    3. Hashes new password with bcrypt
    4. Updates password in database
    
    Requirements: 5.16
    
    Args:
        request: Reset password request with phone, OTP, and new password
        db: Database session
        
    Returns:
        ResetPasswordResponse with success status
        
    Raises:
        HTTPException: If OTP is invalid or user not found
    """
    try:
        import bcrypt
        
        # Verify OTP for PASSWORD_RESET purpose
        result = await db.execute(
            text("""
                SELECT id, verified, expires_at
                FROM otp_verifications
                WHERE phone = :phone
                AND purpose = 'PASSWORD_RESET'
                AND otp_code = :otp_code
                ORDER BY created_at DESC
                LIMIT 1
            """),
            {"phone": request.phone, "otp_code": request.otp_code}
        )
        otp_record = result.first()
        
        if not otp_record:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid OTP for password reset"
            )
        
        otp_id, verified, expires_at = otp_record
        
        # Check if OTP is verified and not expired
        if not verified:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="OTP has not been verified. Please verify OTP first."
            )
        
        from datetime import timezone
        current_time = datetime.now(timezone.utc)
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        
        if current_time > expires_at:
            raise HTTPException(
                status_code=status.HTTP_410_GONE,
                detail="OTP has expired. Please request a new OTP."
            )
        
        # Find user by phone
        result = await db.execute(
            text("SELECT id FROM users_auth WHERE phone = :phone"),
            {"phone": request.phone}
        )
        user_record = result.first()
        
        if not user_record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        user_id = user_record[0]
        
        # Hash new password with bcrypt (12 rounds)
        password_bytes = request.new_password.encode('utf-8')
        salt = bcrypt.gensalt(rounds=12)
        password_hash = bcrypt.hashpw(password_bytes, salt).decode('utf-8')
        
        # Update password in database
        await db.execute(
            text("""
                UPDATE users_auth
                SET password_hash = :password_hash, updated_at = NOW()
                WHERE id = :user_id
            """),
            {"user_id": user_id, "password_hash": password_hash}
        )
        
        # Mark OTP as used (set verified to FALSE to prevent reuse)
        await db.execute(
            text("""
                UPDATE otp_verifications
                SET verified = FALSE
                WHERE id = :otp_id
            """),
            {"otp_id": otp_id}
        )
        
        await db.commit()
        
        logger.info(f"Password reset successful | Phone: {request.phone}")
        
        return ResetPasswordResponse(
            success=True,
            message="Password reset successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error resetting password: {str(e)}", exc_info=True)
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reset password. Please try again."
        )
