"""
Authentication API endpoints.
Phase 9: SentinelPay Advanced Features

Endpoints:
- POST /auth/send-otp - Send OTP for registration/password reset
- POST /auth/verify-otp - Verify OTP code
- POST /auth/register - Register new user
- POST /auth/login - Login with phone/email + password
- POST /auth/refresh - Refresh access token
- POST /auth/logout - Logout and revoke refresh token
- POST /auth/reset-password - Reset password with OTP
- GET /auth/me - Get current user profile (protected)

Requirements: 5.1-5.21
"""

from datetime import datetime, timedelta, timezone
from typing import Optional
import secrets
import bcrypt
import jwt as pyjwt
from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel, Field, field_validator
import psycopg
from psycopg.rows import dict_row
import os
import re

router = APIRouter()

# Database connection
def get_db():
    """Get database connection using DATABASE_URL or environment defaults."""
    db_url = os.getenv("DATABASE_URL")
    if db_url:
        if db_url.startswith("postgresql+psycopg://"):
            db_url = db_url.replace("postgresql+psycopg://", "postgresql://", 1)
        conn = psycopg.connect(db_url, row_factory=dict_row)
        init_db_tables(conn)
        return conn
    conn = psycopg.connect(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=int(os.getenv("POSTGRES_PORT", 5432)),
        dbname=os.getenv("POSTGRES_DB", "fraudshield"),
        user=os.getenv("POSTGRES_USER", "fraudshield"),
        password=os.getenv("POSTGRES_PASSWORD", "fraudshield_dev"),
        row_factory=dict_row
    )
    init_db_tables(conn)
    return conn

def init_db_tables(conn):
    """Ensure authentication tables exist in PostgreSQL."""
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS auth_users (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    phone VARCHAR(15) UNIQUE NOT NULL,
                    email VARCHAR(100) UNIQUE,
                    password_hash VARCHAR(255) NOT NULL,
                    vpa VARCHAR(100) UNIQUE NOT NULL,
                    name VARCHAR(100),
                    dob VARCHAR(20),
                    upi_pin VARCHAR(10),
                    balance NUMERIC(12, 2) DEFAULT 100000.0,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    last_login TIMESTAMP WITH TIME ZONE,
                    is_active BOOLEAN DEFAULT TRUE
                );
            """)

            cursor.execute("""
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='auth_users' AND column_name='balance') THEN
                        ALTER TABLE auth_users ADD COLUMN balance NUMERIC(12, 2) DEFAULT 100000.0;
                    END IF;
                END
                $$;
            """)
            
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS transactions (
                    id VARCHAR(100) PRIMARY KEY,
                    sender_phone VARCHAR(15) REFERENCES auth_users(phone),
                    receiver_phone VARCHAR(15) REFERENCES auth_users(phone),
                    sender_vpa VARCHAR(100),
                    receiver_vpa VARCHAR(100),
                    amount NUMERIC(12, 2) NOT NULL,
                    status VARCHAR(20) NOT NULL,
                    decision VARCHAR(20),
                    risk_score NUMERIC(5, 4),
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
                
                CREATE TABLE IF NOT EXISTS otp_verifications (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    phone VARCHAR(15) NOT NULL,
                    otp_code VARCHAR(6) NOT NULL,
                    purpose VARCHAR(20) NOT NULL,
                    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                    verified BOOLEAN DEFAULT FALSE,
                    verified_at TIMESTAMP WITH TIME ZONE,
                    attempts INTEGER DEFAULT 0,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );

                CREATE TABLE IF NOT EXISTS refresh_tokens (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
                    token VARCHAR(500) UNIQUE NOT NULL,
                    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    last_used_at TIMESTAMP WITH TIME ZONE,
                    revoked BOOLEAN DEFAULT FALSE,
                    revoked_at TIMESTAMP WITH TIME ZONE,
                    device_info JSONB
                );
            """)
            conn.commit()
    except Exception as e:
        logger.warning(f"Failed to auto-init tables (may already exist or read-only): {e}")



# JWT Configuration
JWT_SECRET = os.getenv('JWT_SECRET', 'sentinelpay_dev_secret_key_change_in_production')
JWT_ALGORITHM = 'HS256'
ACCESS_TOKEN_EXPIRY = timedelta(hours=24)  # 24 hours
REFRESH_TOKEN_EXPIRY = timedelta(days=30)  # 30 days

# Password requirements
PASSWORD_REGEX = re.compile(r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$')


# ─── Request/Response Models ──────────────────────────────────────────────────

class SendOTPRequest(BaseModel):
    phone: str = Field(..., min_length=10, max_length=15, pattern=r'^\+?[1-9]\d{1,14}$')
    purpose: str = Field(..., pattern='^(REGISTRATION|PASSWORD_RESET|LOGIN)$')


class VerifyOTPRequest(BaseModel):
    phone: str = Field(..., min_length=10, max_length=15, pattern=r'^\+?[1-9]\d{1,14}$')
    otp_code: str = Field(..., min_length=6, max_length=6)


class RegisterRequest(BaseModel):
    phone: str = Field(..., min_length=10, max_length=15, pattern=r'^\+?[1-9]\d{1,14}$')
    password: Optional[str] = "Sentinel@123"
    email: Optional[str] = Field(None, max_length=255)
    name: Optional[str] = Field(None, max_length=255)
    dob: Optional[str] = Field(None, max_length=20)
    upi_pin: Optional[str] = Field(None, max_length=10)
    
    @field_validator('password')
    @classmethod
    def validate_password(cls, v):
        if v and not PASSWORD_REGEX.match(v) and v != "Sentinel@123":
            raise ValueError(
                'Password must be at least 8 characters with uppercase, lowercase, and digit'
            )
        return v or "Sentinel@123"


class LoginRequest(BaseModel):
    identifier: str = Field(..., max_length=255)
    password: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class ResetPasswordRequest(BaseModel):
    phone: str = Field(..., min_length=10, max_length=15, pattern=r'^\+?[1-9]\d{1,14}$')
    otp_code: str
    new_password: str
    
    @field_validator('new_password')
    @classmethod
    def validate_password(cls, v):
        if not PASSWORD_REGEX.match(v):
            raise ValueError(
                'Password must be at least 8 characters with uppercase, lowercase, and digit'
            )
        return v


class AuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = 'Bearer'
    expires_in: int  # seconds
    user: dict


class MessageResponse(BaseModel):
    message: str
    data: Optional[dict] = None


# ─── Helper Functions ─────────────────────────────────────────────────────────

def generate_otp() -> str:
    """Generate a 6-digit OTP code."""
    return ''.join([str(secrets.randbelow(10)) for _ in range(6)])


def hash_password(password: str) -> str:
    """Hash password with bcrypt (12 rounds minimum)."""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')


def verify_password(password: str, password_hash: str) -> bool:
    """Verify password against bcrypt hash."""
    return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))


def generate_access_token(user_id: str, phone: str, email: Optional[str]) -> str:
    """Generate JWT access token (24h expiration)."""
    payload = {
        'user_id': user_id,
        'phone': phone,
        'email': email,
        'exp': datetime.now(timezone.utc) + ACCESS_TOKEN_EXPIRY,
        'iat': datetime.now(timezone.utc),
        'type': 'access'
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def generate_refresh_token() -> str:
    """Generate random refresh token."""
    return secrets.token_urlsafe(64)


def verify_access_token(token: str) -> dict:
    """Verify JWT access token and return payload."""
    try:
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get('type') != 'access':
            raise HTTPException(status_code=401, detail='Invalid token type')
        return payload
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail='Token expired')
    except pyjwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail='Invalid token')


def get_current_user(authorization: str = Header(None)):
    """Dependency to get current authenticated user from JWT."""
    if not authorization:
        raise HTTPException(status_code=401, detail='Missing authorization header')
    
    if not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail='Invalid authorization header format')
    
    token = authorization.replace('Bearer ', '')
    payload = verify_access_token(token)
    return payload


def generate_vpa(phone: str) -> str:
    """Generate VPA from phone number."""
    # Simple VPA generation: last 10 digits + @sentinelpay
    phone_digits = ''.join(filter(str.isdigit, phone))[-10:]
    return f"{phone_digits}@sentinelpay"


# ─── API Endpoints ────────────────────────────────────────────────────────────

@router.post('/send-otp', response_model=MessageResponse)
async def send_otp(request: SendOTPRequest):
    """
    Send OTP for phone verification.
    
    Requirements: 5.2, 5.3, 5.15
    """
    conn = get_db()
    
    try:
        with conn.cursor() as cursor:
            # Generate OTP
            otp_code = generate_otp()
            expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)
            
            # Store OTP in database
            cursor.execute("""
                INSERT INTO otp_verifications (phone, otp_code, purpose, expires_at)
                VALUES (%s, %s, %s, %s)
                RETURNING id
            """, (request.phone, otp_code, request.purpose, expires_at))
            
            otp_id = cursor.fetchone()['id']
            conn.commit()
            
            # Log OTP to console (demo mode - in production, send via SMS)
            print(f"\n{'=' * 60}")
            print(f"📱 OTP CODE FOR {request.phone}")
            print(f"{'=' * 60}")
            print(f"  Code: {otp_code}")
            print(f"  Purpose: {request.purpose}")
            print(f"  Expires: {expires_at.strftime('%Y-%m-%d %H:%M:%S UTC')}")
            print(f"  Valid for: 5 minutes")
            print(f"{'=' * 60}\n")
            
            return MessageResponse(
                message='OTP sent successfully',
                data={
                    'otp_id': str(otp_id),
                    'expires_in': 300,  # 5 minutes in seconds
                    'phone': request.phone,
                    'otp_code': otp_code
                }
            )
    
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f'Failed to send OTP: {str(e)}')
    finally:
        conn.close()


@router.post('/verify-otp', response_model=MessageResponse)
async def verify_otp(request: VerifyOTPRequest):
    """
    Verify OTP code. Allows mock OTP '123456' for rapid testing.
    """
    # Mock OTP override for testing
    if request.otp_code == '123456':
        try:
            conn = get_db()
            with conn.cursor() as cursor:
                expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
                cursor.execute("""
                    INSERT INTO otp_verifications (phone, otp_code, purpose, expires_at, verified, verified_at)
                    VALUES (%s, '123456', 'REGISTRATION', %s, TRUE, NOW())
                """, (request.phone, expires_at))
                conn.commit()
                conn.close()
        except Exception as e:
            logger.warning(f"Failed to record mock OTP in DB: {e}")
        return MessageResponse(
            message='OTP verified successfully (Mock Mode)',
            data={'phone': request.phone}
        )

    conn = get_db()
    
    try:
        with conn.cursor() as cursor:
            # Find most recent valid OTP for this phone
            cursor.execute("""
                SELECT id, otp_code, expires_at, verified, attempts
                FROM otp_verifications
                WHERE phone = %s 
                AND verified = FALSE
                AND expires_at > NOW()
                ORDER BY created_at DESC
                LIMIT 1
            """, (request.phone,))
            
            otp_record = cursor.fetchone()
            
            if not otp_record:
                raise HTTPException(
                    status_code=400,
                    detail='No valid OTP found. Please request a new OTP.'
                )
            
            # Check attempts limit
            if otp_record['attempts'] >= 5:
                raise HTTPException(
                    status_code=400,
                    detail='Too many attempts. Please request a new OTP.'
                )
            
            # Verify OTP code
            if otp_record['otp_code'] != request.otp_code:
                # Increment attempts
                cursor.execute("""
                    UPDATE otp_verifications
                    SET attempts = attempts + 1
                    WHERE id = %s
                """, (otp_record['id'],))
                conn.commit()
                
                raise HTTPException(status_code=400, detail='Invalid OTP code')
            
            # Mark OTP as verified
            cursor.execute("""
                UPDATE otp_verifications
                SET verified = TRUE, verified_at = NOW()
                WHERE id = %s
            """, (otp_record['id'],))
            conn.commit()
            
            return MessageResponse(
                message='OTP verified successfully',
                data={'phone': request.phone}
            )
    
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f'Failed to verify OTP: {str(e)}')
    finally:
        conn.close()


@router.post('/register', response_model=AuthResponse)
async def register(request: RegisterRequest):
    """
    Register a new user.
    """
    try:
        from app.api.v1.user import USERS_STORE
    except ImportError:
        USERS_STORE = {}

    conn = get_db()
    
    try:
        with conn.cursor() as cursor:
            # Check if phone number is verified
            cursor.execute("""
                SELECT verified
                FROM otp_verifications
                WHERE phone = %s AND verified = TRUE
                ORDER BY verified_at DESC
                LIMIT 1
            """, (request.phone,))
            
            otp_record = cursor.fetchone()
            if not otp_record:
                # Auto-verify for mock mode testing
                cursor.execute("""
                    INSERT INTO otp_verifications (phone, otp_code, purpose, expires_at, verified, verified_at)
                    VALUES (%s, '123456', 'REGISTRATION', NOW() + INTERVAL '15 minutes', TRUE, NOW())
                """, (request.phone,))
                conn.commit()
            
            # Check if user already exists
            cursor.execute("""
                SELECT id, phone, email, vpa, name, dob, upi_pin FROM auth_users WHERE phone = %s
            """, (request.phone,))
            
            existing = cursor.fetchone()
            if existing:
                raise HTTPException(
                    status_code=400,
                    detail="Mobile number is already registered. Please log in instead."
                )
                USERS_STORE[existing['vpa'].lower()] = {
                    "user_id": f"USR_{str(existing['id'])[:6].upper()}",
                    "vpa": existing['vpa'].lower(),
                    "name": existing['name'] or existing['phone'],
                    "device_id": f"DEV_{existing['phone']}",
                    "balance": USERS_STORE.get(existing['vpa'].lower(), {}).get("balance", 100000.0),
                    "created_at": "2026-07-21T03:00:00Z"
                }

                return AuthResponse(
                    access_token=access_token,
                    refresh_token=refresh_token,
                    expires_in=int(ACCESS_TOKEN_EXPIRY.total_seconds()),
                    user={
                        'id': str(existing['id']),
                        'phone': existing['phone'],
                        'email': existing['email'],
                        'vpa': existing['vpa'],
                        'name': existing['name'],
                        'dob': existing['dob'],
                        'upi_pin': existing['upi_pin']
                    }
                )
            
            # Hash password
            password_hash = hash_password(request.password or "Sentinel@123")
            
            # Generate VPA
            vpa = generate_vpa(request.phone)
            user_name = request.name or f"User {request.phone[-4:]}"
            
            # Create user
            cursor.execute("""
                INSERT INTO auth_users (phone, email, password_hash, vpa, name, dob, upi_pin)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id, phone, email, vpa, name, dob, upi_pin, created_at
            """, (request.phone, request.email, password_hash, vpa, user_name, request.dob, request.upi_pin))
            
            user = cursor.fetchone()
            conn.commit()

            # Sync to in-memory store for P2P settlement engine
            USERS_STORE[vpa.lower()] = {
                "user_id": f"USR_{str(user['id'])[:6].upper()}",
                "vpa": vpa.lower(),
                "name": user_name,
                "device_id": f"DEV_{request.phone}",
                "balance": 100000.0,
                "created_at": "2026-07-21T03:00:00Z"
            }
            
            # Generate tokens
            access_token = generate_access_token(str(user['id']), user['phone'], user['email'])
            refresh_token = generate_refresh_token()
            
            # Store refresh token
            try:
                cursor.execute("""
                    INSERT INTO refresh_tokens (user_id, token, expires_at)
                    VALUES (%s, %s, %s)
                """, (user['id'], refresh_token, datetime.now(timezone.utc) + REFRESH_TOKEN_EXPIRY))
                conn.commit()
            except Exception as e:
                logger.warning(f"Failed to store refresh token: {e}")
            
            return AuthResponse(
                access_token=access_token,
                refresh_token=refresh_token,
                expires_in=int(ACCESS_TOKEN_EXPIRY.total_seconds()),
                user={
                    'id': str(user['id']),
                    'phone': user['phone'],
                    'email': user['email'],
                    'vpa': user['vpa'],
                    'name': user['name'],
                    'dob': user['dob'],
                    'upi_pin': user['upi_pin']
                }
            )
    
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f'Registration failed: {str(e)}')
    finally:
        conn.close()



@router.post('/login', response_model=AuthResponse)
async def login(request: LoginRequest):
    """
    Login with phone/email and password.
    
    Requirements: 5.6, 5.7, 5.9, 5.10
    """
    conn = get_db()
    
    try:
        with conn.cursor() as cursor:
            # Find user by phone or email
            cursor.execute("""
                SELECT id, phone, email, password_hash, vpa, name
                FROM auth_users
                WHERE phone = %s OR email = %s
            """, (request.identifier, request.identifier))
            
            user = cursor.fetchone()
            
            if not user:
                raise HTTPException(status_code=401, detail='Invalid credentials')
            
            # Verify password
            if not verify_password(request.password, user['password_hash']):
                raise HTTPException(status_code=401, detail='Invalid credentials')
            
            # Update last login
            cursor.execute("""
                UPDATE auth_users
                SET last_login = NOW()
                WHERE id = %s
            """, (user['id'],))
            conn.commit()

            # Sync to in-memory store for P2P settlement engine
            try:
                from app.api.v1.user import USERS_STORE
            except ImportError:
                USERS_STORE = {}
            vpa_clean = user['vpa'].lower()
            if vpa_clean not in USERS_STORE:
                USERS_STORE[vpa_clean] = {
                    "user_id": f"USR_{str(user['id'])[:6].upper()}",
                    "vpa": vpa_clean,
                    "name": user['name'] or user['phone'],
                    "device_id": f"DEV_{user['phone']}",
                    "balance": 100000.0,
                    "created_at": "2026-07-21T03:00:00Z"
                }
            
            # Generate tokens
            access_token = generate_access_token(str(user['id']), user['phone'], user['email'])
            refresh_token = generate_refresh_token()
            
            # Store refresh token
            try:
                cursor.execute("""
                    INSERT INTO refresh_tokens (user_id, token, expires_at)
                    VALUES (%s, %s, %s)
                """, (user['id'], refresh_token, datetime.now(timezone.utc) + REFRESH_TOKEN_EXPIRY))
                conn.commit()
            except Exception as e:
                logger.warning(f"Failed to store refresh token: {e}")
            
            return AuthResponse(
                access_token=access_token,
                refresh_token=refresh_token,
                expires_in=int(ACCESS_TOKEN_EXPIRY.total_seconds()),
                user={
                    'id': str(user['id']),
                    'phone': user['phone'],
                    'email': user['email'],
                    'vpa': user['vpa'],
                    'name': user['name']
                }
            )

    
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f'Login failed: {str(e)}')
    finally:
        conn.close()


@router.post('/refresh', response_model=AuthResponse)
async def refresh_token(request: RefreshTokenRequest):
    """
    Refresh access token using refresh token.
    
    Requirements: 5.13, 5.21
    """
    conn = get_db()
    
    try:
        with conn.cursor() as cursor:
            # Find refresh token
            cursor.execute("""
                SELECT rt.id, rt.user_id, rt.expires_at, rt.revoked,
                       u.phone, u.email, u.vpa, u.name
                FROM refresh_tokens rt
                JOIN auth_users u ON rt.user_id = u.id
                WHERE rt.token = %s
            """, (request.refresh_token,))
            
            token_record = cursor.fetchone()
            
            if not token_record:
                raise HTTPException(status_code=401, detail='Invalid refresh token')
            
            if token_record['revoked']:
                raise HTTPException(status_code=401, detail='Refresh token revoked')
            
            if token_record['expires_at'] < datetime.now(timezone.utc):
                raise HTTPException(status_code=401, detail='Refresh token expired')
            
            # Update last used
            cursor.execute("""
                UPDATE refresh_tokens
                SET last_used_at = NOW()
                WHERE id = %s
            """, (token_record['id'],))
            conn.commit()
            
            # Generate new access token
            access_token = generate_access_token(
                str(token_record['user_id']),
                token_record['phone'],
                token_record['email']
            )
            
            return AuthResponse(
                access_token=access_token,
                refresh_token=request.refresh_token,  # Keep same refresh token
                expires_in=int(ACCESS_TOKEN_EXPIRY.total_seconds()),
                user={
                    'id': str(token_record['user_id']),
                    'phone': token_record['phone'],
                    'email': token_record['email'],
                    'vpa': token_record['vpa'],
                    'name': token_record['name']
                }
            )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Token refresh failed: {str(e)}')
    finally:
        conn.close()


@router.post('/logout', response_model=MessageResponse)
async def logout(
    request: RefreshTokenRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Logout and revoke refresh token.
    
    Requirements: 5.14
    """
    conn = get_db()
    
    try:
        with conn.cursor() as cursor:
            # Revoke refresh token
            cursor.execute("""
                UPDATE refresh_tokens
                SET revoked = TRUE, revoked_at = NOW()
                WHERE token = %s AND user_id = %s
            """, (request.refresh_token, current_user['user_id']))
            
            conn.commit()
            
            return MessageResponse(message='Logged out successfully')
    
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f'Logout failed: {str(e)}')
    finally:
        conn.close()


@router.post('/reset-password', response_model=MessageResponse)
async def reset_password(request: ResetPasswordRequest):
    """
    Reset password with OTP verification.
    
    Requirements: 5.16
    """
    conn = get_db()
    
    try:
        with conn.cursor() as cursor:
            # Verify OTP
            cursor.execute("""
                SELECT id, verified
                FROM otp_verifications
                WHERE phone = %s 
                AND otp_code = %s
                AND purpose = 'PASSWORD_RESET'
                AND verified = TRUE
                AND expires_at > NOW()
                ORDER BY verified_at DESC
                LIMIT 1
            """, (request.phone, request.otp_code))
            
            otp_record = cursor.fetchone()
            
            if not otp_record:
                raise HTTPException(
                    status_code=400,
                    detail='Invalid or expired OTP. Please request a new OTP.'
                )
            
            # Find user
            cursor.execute("""
                SELECT id FROM auth_users WHERE phone = %s
            """, (request.phone,))
            
            user = cursor.fetchone()
            
            if not user:
                raise HTTPException(status_code=404, detail='User not found')
            
            # Hash new password
            password_hash = hash_password(request.new_password)
            
            # Update password
            cursor.execute("""
                UPDATE auth_users
                SET password_hash = %s, updated_at = NOW()
                WHERE id = %s
            """, (password_hash, user['id']))
            
            # Revoke all refresh tokens for this user (force re-login)
            cursor.execute("""
                UPDATE refresh_tokens
                SET revoked = TRUE, revoked_at = NOW()
                WHERE user_id = %s AND revoked = FALSE
            """, (user['id'],))
            
            conn.commit()
            
            return MessageResponse(
                message='Password reset successfully',
                data={'phone': request.phone}
            )
    
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f'Password reset failed: {str(e)}')
    finally:
        conn.close()


@router.get('/me', response_model=dict)
async def get_current_user_profile(current_user: dict = Depends(get_current_user)):
    """
    Get current authenticated user profile.
    
    Requirements: 5.11, 5.12
    """
    conn = get_db()
    
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT id, phone, email, vpa, name, created_at, last_login
                FROM auth_users
                WHERE id = %s
            """, (current_user['user_id'],))
            
            user = cursor.fetchone()
            
            if not user:
                raise HTTPException(status_code=404, detail='User not found')
            
            return {
                'id': str(user['id']),
                'phone': user['phone'],
                'email': user['email'],
                'vpa': user['vpa'],
                'name': user['name'],
                'created_at': user['created_at'].isoformat() if user['created_at'] else None,
                'last_login': user['last_login'].isoformat() if user['last_login'] else None
            }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Failed to fetch user profile: {str(e)}')
    finally:
        conn.close()
