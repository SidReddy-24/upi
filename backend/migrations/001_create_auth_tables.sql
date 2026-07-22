-- Migration: 001_create_auth_tables.sql
-- Description: Create database tables for JWT authentication system
-- Requirements: 5.1, 5.19, 5.20
-- Date: 2024-01-XX
-- Author: SentinelPay Development Team

-- ======================== USERS_AUTH ========================
-- User authentication accounts with secure credential storage
CREATE TABLE IF NOT EXISTS users_auth (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(15) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    vpa VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT chk_phone_format CHECK (phone ~ '^\+?[0-9]{10,15}$'),
    CONSTRAINT chk_email_format CHECK (email IS NULL OR email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT chk_vpa_format CHECK (vpa ~ '^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$')
);

-- Indexes for users_auth table
CREATE INDEX IF NOT EXISTS idx_users_auth_phone ON users_auth(phone);
CREATE INDEX IF NOT EXISTS idx_users_auth_email ON users_auth(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_auth_vpa ON users_auth(vpa);

COMMENT ON TABLE users_auth IS 'User authentication accounts with secure credential storage';
COMMENT ON COLUMN users_auth.id IS 'Unique user identifier';
COMMENT ON COLUMN users_auth.phone IS 'User phone number (unique)';
COMMENT ON COLUMN users_auth.email IS 'User email address (optional, unique)';
COMMENT ON COLUMN users_auth.password_hash IS 'bcrypt password hash (≥12 rounds)';
COMMENT ON COLUMN users_auth.vpa IS 'Virtual Payment Address (UPI identifier)';
COMMENT ON COLUMN users_auth.created_at IS 'Account creation timestamp';
COMMENT ON COLUMN users_auth.updated_at IS 'Last profile update timestamp';
COMMENT ON COLUMN users_auth.last_login IS 'Last successful login timestamp';

-- ======================== OTP_VERIFICATIONS ========================
-- OTP verification codes for authentication flows
CREATE TABLE IF NOT EXISTS otp_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(15) NOT NULL,
    otp_code VARCHAR(6) NOT NULL,
    purpose VARCHAR(20) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    user_id UUID REFERENCES users_auth(id) ON DELETE CASCADE,
    
    CONSTRAINT chk_otp_purpose CHECK (purpose IN ('REGISTRATION', 'PASSWORD_RESET', 'LOGIN')),
    CONSTRAINT chk_otp_code_format CHECK (otp_code ~ '^[0-9]{6}$')
);

-- Indexes for otp_verifications table
CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_verifications(phone);
CREATE INDEX IF NOT EXISTS idx_otp_phone_purpose ON otp_verifications(phone, purpose);
CREATE INDEX IF NOT EXISTS idx_otp_expires_at ON otp_verifications(expires_at);
CREATE INDEX IF NOT EXISTS idx_otp_user_id ON otp_verifications(user_id) WHERE user_id IS NOT NULL;

COMMENT ON TABLE otp_verifications IS 'OTP verification codes for authentication flows';
COMMENT ON COLUMN otp_verifications.id IS 'Unique OTP record identifier';
COMMENT ON COLUMN otp_verifications.phone IS 'Phone number for OTP delivery';
COMMENT ON COLUMN otp_verifications.otp_code IS '6-digit verification code';
COMMENT ON COLUMN otp_verifications.purpose IS 'OTP purpose: REGISTRATION, PASSWORD_RESET, LOGIN';
COMMENT ON COLUMN otp_verifications.expires_at IS 'OTP expiration timestamp (5 minutes from creation)';
COMMENT ON COLUMN otp_verifications.verified IS 'Whether OTP has been successfully verified';
COMMENT ON COLUMN otp_verifications.created_at IS 'OTP generation timestamp';
COMMENT ON COLUMN otp_verifications.user_id IS 'Associated user ID (null for registration OTPs)';

-- ======================== REFRESH_TOKENS ========================
-- Refresh tokens for session management
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users_auth(id) ON DELETE CASCADE,
    token VARCHAR(500) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    CONSTRAINT chk_token_not_empty CHECK (LENGTH(token) > 10)
);

-- Indexes for refresh_tokens table
CREATE INDEX IF NOT EXISTS idx_refresh_token ON refresh_tokens(token);
CREATE INDEX IF NOT EXISTS idx_refresh_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_expires_at ON refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_refresh_active ON refresh_tokens(user_id, revoked) WHERE revoked = FALSE;

COMMENT ON TABLE refresh_tokens IS 'Refresh tokens for session management';
COMMENT ON COLUMN refresh_tokens.id IS 'Unique token record identifier';
COMMENT ON COLUMN refresh_tokens.user_id IS 'User who owns this refresh token';
COMMENT ON COLUMN refresh_tokens.token IS 'Refresh token value (JWT or random string)';
COMMENT ON COLUMN refresh_tokens.expires_at IS 'Token expiration timestamp (30 days)';
COMMENT ON COLUMN refresh_tokens.revoked IS 'Whether token has been revoked';
COMMENT ON COLUMN refresh_tokens.created_at IS 'Token creation timestamp';

-- ======================== TRIGGERS ========================
-- Auto-update updated_at timestamp on users_auth table
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_users_auth_updated_at
BEFORE UPDATE ON users_auth
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ======================== CLEANUP FUNCTIONS ========================
-- Function to clean up expired OTP records (to be called periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM otp_verifications
    WHERE expires_at < NOW() - INTERVAL '1 day';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired refresh tokens
CREATE OR REPLACE FUNCTION cleanup_expired_refresh_tokens()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM refresh_tokens
    WHERE expires_at < NOW() - INTERVAL '7 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_otps IS 'Removes OTP records older than 1 day (for periodic cleanup)';
COMMENT ON FUNCTION cleanup_expired_refresh_tokens IS 'Removes expired refresh tokens older than 7 days (for periodic cleanup)';

-- ======================== INDEXES FOR PERFORMANCE ========================
-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_otp_phone_verified_expires 
ON otp_verifications(phone, verified, expires_at) 
WHERE verified = FALSE;

-- Index for token validation queries
CREATE INDEX IF NOT EXISTS idx_refresh_token_active 
ON refresh_tokens(token, revoked, expires_at) 
WHERE revoked = FALSE;
