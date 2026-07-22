# Database Models Documentation

This directory contains data models for the SentinelPay backend application.

## Model Types

### Pydantic Models (API Request/Response)
- `transaction.py` - Transaction request validation schemas
- `feedback.py` - Analyst feedback request/response schemas
- `scoring_result.py` - Fraud scoring response schemas

### SQLAlchemy ORM Models (Database Tables)
- `auth.py` - Authentication system models (users, OTP, refresh tokens)

## Authentication Models (`auth.py`)

The authentication models support the JWT-based authentication system with OTP verification, secure password storage, and session management.

### Models Overview

| Model | Table | Purpose | Requirements |
|-------|-------|---------|--------------|
| `User` | `users_auth` | User accounts with authentication credentials | 5.1, 5.19, 5.20 |
| `OtpVerification` | `otp_verifications` | OTP codes for registration/login/password reset | 5.1, 5.19 |
| `RefreshToken` | `refresh_tokens` | JWT refresh tokens for session management | 5.1 |

### User Model

**Table:** `users_auth`

Stores user authentication credentials and profile information.

**Fields:**
- `id` (UUID, PK): Unique user identifier
- `phone` (VARCHAR(15), UNIQUE, NOT NULL): User phone number
- `email` (VARCHAR(100), UNIQUE, NULLABLE): User email address (optional)
- `password_hash` (VARCHAR(255), NOT NULL): bcrypt password hash (≥12 rounds)
- `vpa` (VARCHAR(100), UNIQUE, NOT NULL): Virtual Payment Address (UPI identifier)
- `created_at` (TIMESTAMP): Account creation timestamp
- `updated_at` (TIMESTAMP): Last profile update timestamp (auto-updated via trigger)
- `last_login` (TIMESTAMP): Last successful login timestamp

**Constraints:**
- Phone format: `^\+?[0-9]{10,15}$`
- Email format: `^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$` (if provided)
- VPA format: `^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$`

**Indexes:**
- `idx_users_auth_phone` on `phone`
- `idx_users_auth_email` on `email` (partial index WHERE email IS NOT NULL)
- `idx_users_auth_vpa` on `vpa`

**Relationships:**
- One-to-many with `OtpVerification`
- One-to-many with `RefreshToken`
- CASCADE delete to child records

### OtpVerification Model

**Table:** `otp_verifications`

Stores time-limited OTP codes for various authentication flows.

**Fields:**
- `id` (UUID, PK): Unique OTP record identifier
- `phone` (VARCHAR(15), NOT NULL): Phone number for OTP delivery
- `otp_code` (VARCHAR(6), NOT NULL): 6-digit verification code
- `purpose` (VARCHAR(20), NOT NULL): OTP purpose (REGISTRATION | PASSWORD_RESET | LOGIN)
- `expires_at` (TIMESTAMP, NOT NULL): OTP expiration timestamp (5 minutes)
- `verified` (BOOLEAN, DEFAULT FALSE): Whether OTP has been successfully verified
- `created_at` (TIMESTAMP): OTP generation timestamp
- `user_id` (UUID, FK, NULLABLE): Associated user (NULL for registration OTPs)

**Constraints:**
- Purpose must be: `REGISTRATION`, `PASSWORD_RESET`, or `LOGIN`
- OTP code format: `^[0-9]{6}$`

**Indexes:**
- `idx_otp_phone` on `phone`
- `idx_otp_phone_purpose` on `(phone, purpose)`
- `idx_otp_expires_at` on `expires_at`
- `idx_otp_phone_verified_expires` on `(phone, verified, expires_at)` WHERE `verified = FALSE`
- `idx_otp_user_id` on `user_id` (partial index WHERE user_id IS NOT NULL)

**Relationships:**
- Many-to-one with `User`
- CASCADE delete when user is deleted

### RefreshToken Model

**Table:** `refresh_tokens`

Manages long-lived refresh tokens for session management.

**Fields:**
- `id` (UUID, PK): Unique token record identifier
- `user_id` (UUID, FK, NOT NULL): User who owns this refresh token
- `token` (VARCHAR(500), UNIQUE, NOT NULL): Refresh token value (JWT or random string)
- `expires_at` (TIMESTAMP, NOT NULL): Token expiration timestamp (30 days)
- `revoked` (BOOLEAN, DEFAULT FALSE): Whether token has been revoked
- `created_at` (TIMESTAMP): Token creation timestamp

**Constraints:**
- Token must be > 10 characters

**Indexes:**
- `idx_refresh_token` on `token`
- `idx_refresh_user_id` on `user_id`
- `idx_refresh_expires_at` on `expires_at`
- `idx_refresh_active` on `(user_id, revoked)` WHERE `revoked = FALSE`
- `idx_refresh_token_active` on `(token, revoked, expires_at)` WHERE `revoked = FALSE`

**Relationships:**
- Many-to-one with `User`
- CASCADE delete when user is deleted

## Database Triggers

### update_updated_at_column()

Automatically updates the `updated_at` timestamp on `users_auth` table whenever a row is modified.

**Trigger:** `trigger_users_auth_updated_at`  
**Event:** BEFORE UPDATE on `users_auth`

## Cleanup Functions

### cleanup_expired_otps()

Removes OTP records older than 1 day to prevent table bloat.

**Returns:** Count of deleted records

**Usage:**
```sql
SELECT cleanup_expired_otps();
```

**Recommended Schedule:** Run daily via cron

### cleanup_expired_refresh_tokens()

Removes expired refresh tokens older than 7 days.

**Returns:** Count of deleted records

**Usage:**
```sql
SELECT cleanup_expired_refresh_tokens();
```

**Recommended Schedule:** Run daily via cron

## Usage Examples

### Creating a User

```python
from app.models.auth import User
from app.db.database import async_session_factory
from passlib.hash import bcrypt

async def create_user(phone: str, password: str, vpa: str, email: str = None):
    async with async_session_factory() as session:
        # Hash password
        password_hash = bcrypt.hash(password)
        
        # Create user (using raw SQL with ORM models)
        from sqlalchemy import text
        result = await session.execute(
            text("""
            INSERT INTO users_auth (phone, email, password_hash, vpa)
            VALUES (:phone, :email, :password_hash, :vpa)
            RETURNING id
            """),
            {
                "phone": phone,
                "email": email,
                "password_hash": password_hash,
                "vpa": vpa
            }
        )
        user_id = result.fetchone()[0]
        await session.commit()
        return user_id
```

### Generating OTP

```python
import random
from datetime import datetime, timedelta

async def generate_otp(phone: str, purpose: str):
    otp_code = f"{random.randint(0, 999999):06d}"
    expires_at = datetime.utcnow() + timedelta(minutes=5)
    
    async with async_session_factory() as session:
        await session.execute(
            text("""
            INSERT INTO otp_verifications (phone, otp_code, purpose, expires_at)
            VALUES (:phone, :otp_code, :purpose, :expires_at)
            """),
            {
                "phone": phone,
                "otp_code": otp_code,
                "purpose": purpose,
                "expires_at": expires_at
            }
        )
        await session.commit()
        return otp_code
```

### Verifying OTP

```python
async def verify_otp(phone: str, otp_code: str, purpose: str) -> bool:
    async with async_session_factory() as session:
        result = await session.execute(
            text("""
            SELECT id 
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
                "phone": phone,
                "otp_code": otp_code,
                "purpose": purpose
            }
        )
        otp_record = result.fetchone()
        
        if otp_record:
            # Mark as verified
            await session.execute(
                text("UPDATE otp_verifications SET verified = TRUE WHERE id = :id"),
                {"id": otp_record[0]}
            )
            await session.commit()
            return True
        return False
```

### Creating Refresh Token

```python
import secrets
from datetime import datetime, timedelta

async def create_refresh_token(user_id: str) -> str:
    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(days=30)
    
    async with async_session_factory() as session:
        await session.execute(
            text("""
            INSERT INTO refresh_tokens (user_id, token, expires_at)
            VALUES (:user_id, :token, :expires_at)
            """),
            {
                "user_id": user_id,
                "token": token,
                "expires_at": expires_at
            }
        )
        await session.commit()
        return token
```

### Validating Refresh Token

```python
async def validate_refresh_token(token: str) -> dict | None:
    async with async_session_factory() as session:
        result = await session.execute(
            text("""
            SELECT user_id, expires_at 
            FROM refresh_tokens 
            WHERE token = :token 
            AND revoked = FALSE 
            AND expires_at > NOW()
            """),
            {"token": token}
        )
        token_record = result.fetchone()
        
        if token_record:
            return {
                "user_id": str(token_record[0]),
                "expires_at": token_record[1]
            }
        return None
```

### Revoking Refresh Token

```python
async def revoke_refresh_token(token: str):
    async with async_session_factory() as session:
        await session.execute(
            text("UPDATE refresh_tokens SET revoked = TRUE WHERE token = :token"),
            {"token": token}
        )
        await session.commit()
```

## Integration with Existing System

The authentication models integrate with the existing FraudShield system:

1. **VPA Linking**: The `vpa` field in `users_auth` links to the existing UPI wallet system
2. **Database Connection**: Uses the same `async_session_factory` from `app/db/database.py`
3. **Configuration**: Reads database URL from `app/config.py` settings

## Security Considerations

1. **Password Storage**: Always use bcrypt with ≥12 rounds
2. **OTP Security**: 
   - 6-digit codes
   - 5-minute expiration
   - Single-use (mark as verified after successful use)
3. **Token Management**:
   - Refresh tokens expire after 30 days
   - Support revocation for logout
   - Unique constraint prevents token reuse
4. **Data Validation**: Check constraints enforce proper formats at database level

## Testing

Run the model tests:

```bash
pytest tests/test_auth_models.py -v
```

## Migrations

See `backend/migrations/README.md` for migration documentation.
