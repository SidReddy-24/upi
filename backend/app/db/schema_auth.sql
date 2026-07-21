-- =============================================================
-- SentinelPay Authentication System — PostgreSQL Schema
-- Phase 9: Advanced Features
-- =============================================================

-- ======================== AUTH USERS ========================
-- Separate from fraud detection users table
CREATE TABLE IF NOT EXISTS auth_users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone               VARCHAR(15) UNIQUE NOT NULL,
    email               VARCHAR(100) UNIQUE,
    password_hash       VARCHAR(255) NOT NULL,
    vpa                 VARCHAR(100) UNIQUE NOT NULL,
    name                VARCHAR(100),
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login          TIMESTAMP WITH TIME ZONE,
    is_active           BOOLEAN DEFAULT TRUE,
    
    CONSTRAINT chk_phone_format CHECK (phone ~ '^\+?[1-9]\d{1,14}$'),
    CONSTRAINT chk_email_format CHECK (email IS NULL OR email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);

CREATE INDEX IF NOT EXISTS idx_auth_user_phone ON auth_users(phone);
CREATE INDEX IF NOT EXISTS idx_auth_user_email ON auth_users(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_auth_user_vpa ON auth_users(vpa);
CREATE INDEX IF NOT EXISTS idx_auth_user_active ON auth_users(is_active) WHERE is_active = TRUE;

-- ======================== OTP VERIFICATIONS ========================
CREATE TABLE IF NOT EXISTS otp_verifications (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone               VARCHAR(15) NOT NULL,
    otp_code            VARCHAR(6) NOT NULL,
    purpose             VARCHAR(20) NOT NULL,
    expires_at          TIMESTAMP WITH TIME ZONE NOT NULL,
    verified            BOOLEAN DEFAULT FALSE,
    verified_at         TIMESTAMP WITH TIME ZONE,
    attempts            INTEGER DEFAULT 0,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT chk_otp_purpose CHECK (purpose IN ('REGISTRATION', 'PASSWORD_RESET', 'LOGIN')),
    CONSTRAINT chk_otp_code_format CHECK (otp_code ~ '^\d{6}$'),
    CONSTRAINT chk_attempts_limit CHECK (attempts <= 5)
);

CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_verifications(phone);
CREATE INDEX IF NOT EXISTS idx_otp_expires ON otp_verifications(expires_at);
CREATE INDEX IF NOT EXISTS idx_otp_verified ON otp_verifications(verified) WHERE verified = FALSE;

-- Cleanup: delete expired OTPs periodically

-- ======================== REFRESH TOKENS ========================
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    token               VARCHAR(500) UNIQUE NOT NULL,
    expires_at          TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at        TIMESTAMP WITH TIME ZONE,
    revoked             BOOLEAN DEFAULT FALSE,
    revoked_at          TIMESTAMP WITH TIME ZONE,
    device_info         JSONB,
    
    CONSTRAINT chk_token_not_empty CHECK (token != '')
);

CREATE INDEX IF NOT EXISTS idx_refresh_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_token ON refresh_tokens(token) WHERE revoked = FALSE;
CREATE INDEX IF NOT EXISTS idx_refresh_expires ON refresh_tokens(expires_at);

-- Cleanup: delete expired tokens periodically

-- ======================== GUARDIAN RELATIONSHIPS ========================
-- Phase 9: Guardian approval system
CREATE TABLE IF NOT EXISTS guardian_relationships (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    guardian_phone      VARCHAR(15),
    guardian_vpa        VARCHAR(100),
    guardian_user_id    UUID REFERENCES auth_users(id) ON DELETE SET NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    invited_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    accepted_at         TIMESTAMP WITH TIME ZONE,
    rejected_at         TIMESTAMP WITH TIME ZONE,
    removed_at          TIMESTAMP WITH TIME ZONE,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT chk_guardian_status CHECK (status IN ('PENDING', 'ACTIVE', 'REJECTED', 'REMOVED')),
    CONSTRAINT chk_guardian_contact CHECK (guardian_phone IS NOT NULL OR guardian_vpa IS NOT NULL),
    
    -- Ensure user cannot be their own guardian
    CONSTRAINT chk_not_self_guardian CHECK (user_id != guardian_user_id),
    
    -- Unique constraint: user can only have one relationship with a specific guardian
    CONSTRAINT unique_user_guardian UNIQUE (user_id, guardian_phone, guardian_vpa)
);

CREATE INDEX IF NOT EXISTS idx_guardian_user_id ON guardian_relationships(user_id);
CREATE INDEX IF NOT EXISTS idx_guardian_phone ON guardian_relationships(guardian_phone);
CREATE INDEX IF NOT EXISTS idx_guardian_vpa ON guardian_relationships(guardian_vpa);
CREATE INDEX IF NOT EXISTS idx_guardian_status ON guardian_relationships(status);
CREATE INDEX IF NOT EXISTS idx_guardian_user_active ON guardian_relationships(user_id, status) 
    WHERE status = 'ACTIVE';

-- Function to enforce max 5 active guardians per user
CREATE OR REPLACE FUNCTION check_max_guardians()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'ACTIVE' THEN
        IF (SELECT COUNT(*) FROM guardian_relationships 
            WHERE user_id = NEW.user_id AND status = 'ACTIVE' AND id != NEW.id) >= 5 THEN
            RAISE EXCEPTION 'User can have maximum 5 active guardians';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_max_guardians
    BEFORE INSERT OR UPDATE ON guardian_relationships
    FOR EACH ROW
    EXECUTE FUNCTION check_max_guardians();

-- ======================== GUARDIAN APPROVAL REQUESTS ========================
CREATE TABLE IF NOT EXISTS guardian_approval_requests (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id      VARCHAR(64) NOT NULL,
    user_id             UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    guardian_id         UUID NOT NULL REFERENCES guardian_relationships(id) ON DELETE CASCADE,
    amount              DECIMAL(10, 2) NOT NULL,
    recipient_vpa       VARCHAR(100) NOT NULL,
    fraud_score         DECIMAL(3, 2) NOT NULL,
    risk_signals        JSONB NOT NULL DEFAULT '[]',
    status              VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    expires_at          TIMESTAMP WITH TIME ZONE NOT NULL,
    responded_at        TIMESTAMP WITH TIME ZONE,
    response_note       TEXT,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT chk_approval_status CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED')),
    CONSTRAINT chk_fraud_score_range CHECK (fraud_score >= 0 AND fraud_score <= 1),
    CONSTRAINT chk_amount_positive CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS idx_approval_transaction ON guardian_approval_requests(transaction_id);
CREATE INDEX IF NOT EXISTS idx_approval_user ON guardian_approval_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_approval_guardian ON guardian_approval_requests(guardian_id);
CREATE INDEX IF NOT EXISTS idx_approval_status ON guardian_approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_approval_expires ON guardian_approval_requests(expires_at);
CREATE INDEX IF NOT EXISTS idx_approval_pending ON guardian_approval_requests(guardian_id, status, expires_at)
    WHERE status = 'PENDING';

-- Cleanup: expire pending approval requests periodically

-- ======================== COMMENTS ========================
COMMENT ON TABLE auth_users IS 'User authentication data separate from fraud detection users';
COMMENT ON TABLE otp_verifications IS 'OTP codes for phone verification (registration, password reset, 2FA)';
COMMENT ON TABLE refresh_tokens IS 'JWT refresh tokens for session management';
COMMENT ON TABLE guardian_relationships IS 'Guardian relationships for high-risk transaction approval';
COMMENT ON TABLE guardian_approval_requests IS 'Guardian approval requests with 5-minute expiration';

COMMENT ON COLUMN auth_users.password_hash IS 'bcrypt hash with 12+ rounds';
COMMENT ON COLUMN otp_verifications.otp_code IS '6-digit OTP code';
COMMENT ON COLUMN otp_verifications.expires_at IS 'OTP expires 5 minutes after creation';
COMMENT ON COLUMN refresh_tokens.expires_at IS 'Refresh token expires after 30 days';
COMMENT ON COLUMN guardian_approval_requests.expires_at IS 'Approval request expires after 5 minutes';
