-- =============================================================
-- FraudShield AI — PostgreSQL Schema
-- SRD Section 14.1
-- =============================================================

-- ======================== USERS ========================
CREATE TABLE IF NOT EXISTS users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             VARCHAR(64) UNIQUE NOT NULL,
    vpa                 VARCHAR(128) UNIQUE NOT NULL,
    phone_hash          VARCHAR(64),
    account_created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    home_lat            DECIMAL(9, 6),
    home_lon            DECIMAL(9, 6),
    home_country        CHAR(2) DEFAULT 'IN',
    risk_level          VARCHAR(8) DEFAULT 'NORMAL',
    fraud_flag          BOOLEAN DEFAULT FALSE,
    fraud_confirmed_at  TIMESTAMP WITH TIME ZONE,
    is_active           BOOLEAN DEFAULT TRUE,
    last_seen_at        TIMESTAMP WITH TIME ZONE,
    total_txns          INTEGER DEFAULT 0,
    profile_confidence  DECIMAL(4, 3) DEFAULT 0.0,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_vpa    ON users(vpa);
CREATE INDEX IF NOT EXISTS idx_user_fraud  ON users(fraud_flag) WHERE fraud_flag = TRUE;
CREATE INDEX IF NOT EXISTS idx_user_risk   ON users(risk_level) WHERE risk_level = 'HIGH';

-- ======================== DEVICES ========================
CREATE TABLE IF NOT EXISTS devices (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id           VARCHAR(64) UNIQUE NOT NULL,
    fp_hash             VARCHAR(64) NOT NULL,
    os_type             VARCHAR(16),
    os_version          VARCHAR(32),
    app_version         VARCHAR(16),
    cpu_model           VARCHAR(64),
    screen_resolution   VARCHAR(16),
    is_rooted           BOOLEAN DEFAULT FALSE,
    is_emulator         BOOLEAN DEFAULT FALSE,
    root_detected_at    TIMESTAMP WITH TIME ZONE,
    first_seen_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_seen_at        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    total_users         INTEGER DEFAULT 1,
    fraud_flag          BOOLEAN DEFAULT FALSE,
    carrier_hash        VARCHAR(64),
    sim_hash            VARCHAR(64),
    risk_score          DECIMAL(5, 4) DEFAULT 0.0,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_fp_hash  ON devices(fp_hash);
CREATE INDEX IF NOT EXISTS idx_device_fraud    ON devices(fraud_flag) WHERE fraud_flag = TRUE;

-- ======================== TRANSACTIONS ========================
CREATE TABLE IF NOT EXISTS transactions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id      VARCHAR(64) UNIQUE NOT NULL,
    sender_vpa          VARCHAR(128) NOT NULL,
    receiver_vpa        VARCHAR(128) NOT NULL,
    amount              DECIMAL(15, 2) NOT NULL,
    currency            CHAR(3) NOT NULL DEFAULT 'INR',
    txn_type            VARCHAR(16) NOT NULL,
    device_id           VARCHAR(64),
    ip_address          INET,
    geo_lat             DECIMAL(9, 6),
    geo_lon             DECIMAL(9, 6),
    risk_score          DECIMAL(5, 4),
    confidence          DECIMAL(5, 4),
    decision            VARCHAR(8),
    model_version       VARCHAR(32),
    latency_ms          INTEGER,
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    scored_at           TIMESTAMP WITH TIME ZONE,
    status              VARCHAR(16) DEFAULT 'PENDING',

    CONSTRAINT chk_decision CHECK (decision IS NULL OR decision IN ('APPROVE', 'REVIEW', 'REJECT')),
    CONSTRAINT chk_amount CHECK (amount > 0 AND amount <= 200000)
);

CREATE INDEX IF NOT EXISTS idx_txn_sender_vpa   ON transactions(sender_vpa);
CREATE INDEX IF NOT EXISTS idx_txn_receiver_vpa ON transactions(receiver_vpa);
CREATE INDEX IF NOT EXISTS idx_txn_device_id    ON transactions(device_id);
CREATE INDEX IF NOT EXISTS idx_txn_created_at   ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_txn_decision     ON transactions(decision) WHERE decision IN ('REVIEW', 'REJECT');
CREATE INDEX IF NOT EXISTS idx_txn_risk_score   ON transactions(risk_score DESC) WHERE risk_score > 0.5;

-- ======================== RISK SCORES ========================
CREATE TABLE IF NOT EXISTS risk_scores (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id      VARCHAR(64) NOT NULL REFERENCES transactions(transaction_id),
    ml_score            DECIMAL(5, 4),
    iso_score           DECIMAL(5, 4),
    rule_risk           DECIMAL(5, 4),
    behavioral_score    DECIMAL(5, 4),
    graph_risk          DECIMAL(5, 4),
    composite_risk      DECIMAL(5, 4) NOT NULL,
    confidence          DECIMAL(5, 4) NOT NULL,
    rule_flags          JSONB DEFAULT '[]',
    shap_values         JSONB,
    reasons             JSONB,
    nl_summary          TEXT,
    model_version       VARCHAR(32),
    scored_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_risk_txn_id    ON risk_scores(transaction_id);
CREATE INDEX IF NOT EXISTS idx_risk_composite ON risk_scores(composite_risk DESC);

-- ======================== FRAUD CASES ========================
CREATE TABLE IF NOT EXISTS fraud_cases (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id             VARCHAR(32) UNIQUE NOT NULL,
    transaction_id      VARCHAR(64) REFERENCES transactions(transaction_id),
    user_id             VARCHAR(64),
    fraud_type          VARCHAR(32),
    status              VARCHAR(16) DEFAULT 'OPEN',
    priority            VARCHAR(8) DEFAULT 'MEDIUM',
    assigned_to         VARCHAR(64),
    opened_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    closed_at           TIMESTAMP WITH TIME ZONE,
    loss_amount         DECIMAL(15, 2),
    recovery_amount     DECIMAL(15, 2) DEFAULT 0.0,
    notes               TEXT,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ======================== FEEDBACK ========================
CREATE TABLE IF NOT EXISTS feedback (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id      VARCHAR(64) NOT NULL,
    analyst_id          VARCHAR(64) NOT NULL,
    feedback_type       VARCHAR(16) NOT NULL,
    original_decision   VARCHAR(8) NOT NULL,
    analyst_decision    VARCHAR(16) NOT NULL,
    fraud_type          VARCHAR(32),
    notes               TEXT,
    submitted_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT chk_feedback_type CHECK (feedback_type IN ('CONFIRM_FRAUD', 'CLEAR_FRAUD', 'ESCALATE')),
    CONSTRAINT chk_analyst_decision CHECK (analyst_decision IN ('FRAUD', 'LEGITIMATE', 'INCONCLUSIVE'))
);

CREATE INDEX IF NOT EXISTS idx_feedback_txn_id  ON feedback(transaction_id);
CREATE INDEX IF NOT EXISTS idx_feedback_submitted ON feedback(submitted_at DESC);

-- ======================== RULES ========================
CREATE TABLE IF NOT EXISTS rules (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id             VARCHAR(16) UNIQUE NOT NULL,
    name                VARCHAR(128) NOT NULL,
    description         TEXT,
    condition_dsl       JSONB NOT NULL,
    action              VARCHAR(16) NOT NULL,
    severity            VARCHAR(8) NOT NULL,
    explanation         TEXT NOT NULL,
    priority            INTEGER NOT NULL DEFAULT 100,
    is_active           BOOLEAN DEFAULT TRUE,
    created_by          VARCHAR(64),
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    triggered_count     BIGINT DEFAULT 0
);

-- ======================== AUDIT LOGS ========================
CREATE TABLE IF NOT EXISTS audit_logs (
    id                  BIGSERIAL PRIMARY KEY,
    event_id            UUID DEFAULT gen_random_uuid(),
    event_type          VARCHAR(32) NOT NULL,
    transaction_id      VARCHAR(64),
    user_id             VARCHAR(64),
    org_id              VARCHAR(64),
    model_version       VARCHAR(32),
    risk_score          DECIMAL(5, 4),
    decision            VARCHAR(8),
    latency_ms          INTEGER,
    feature_snapshot    JSONB,
    request_metadata    JSONB,
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_txn_id   ON audit_logs(transaction_id);
CREATE INDEX IF NOT EXISTS idx_audit_created  ON audit_logs(created_at DESC);

-- ======================== MODEL REGISTRY ========================
CREATE TABLE IF NOT EXISTS model_registry (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id            VARCHAR(64) UNIQUE NOT NULL,
    model_type          VARCHAR(32) NOT NULL,
    version             VARCHAR(32) NOT NULL,
    artifact_path       TEXT NOT NULL,
    training_date       DATE NOT NULL,
    training_dataset    VARCHAR(64),
    metrics             JSONB,
    is_production       BOOLEAN DEFAULT FALSE,
    is_shadow           BOOLEAN DEFAULT FALSE,
    deployed_at         TIMESTAMP WITH TIME ZONE,
    retired_at          TIMESTAMP WITH TIME ZONE,
    created_by          VARCHAR(64),
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ======================== SEED RULES ========================
INSERT INTO rules (rule_id, name, condition_dsl, action, severity, explanation, priority)
VALUES
('R001', 'Blacklisted Receiver', '{"AND": [{"feature": "receiver_is_blacklisted", "op": "eq", "value": 1}]}', 'REJECT', 'CRITICAL', 'Recipient VPA is on the fraud blacklist', 10),
('R002', 'Extreme Amount', '{"AND": [{"feature": "amount_vs_user_max_ratio", "op": "gt", "value": 3.0}]}', 'FLAG', 'HIGH', 'Transaction amount exceeds 3x user historical maximum', 20),
('R003', 'High Velocity', '{"AND": [{"feature": "vel_txn_count_1m", "op": "gt", "value": 5}]}', 'FLAG', 'HIGH', 'More than 5 transactions in the last minute', 30),
('R004', 'New Device High Amount', '{"AND": [{"feature": "device_is_new", "op": "eq", "value": 1}, {"feature": "txn_amount", "op": "gt", "value": 10000}]}', 'FLAG', 'MEDIUM', 'High-value transaction from an unrecognized device', 40),
('R005', 'Impossible Travel', '{"AND": [{"feature": "geo_distance_from_last_txn_km", "op": "gt", "value": 500}, {"feature": "time_since_last_txn_seconds", "op": "lt", "value": 1800}]}', 'FLAG', 'HIGH', 'Transaction location is physically impossible given prior transaction timing', 50),
('R006', 'New Receiver High Amount', '{"AND": [{"feature": "receiver_is_new", "op": "eq", "value": 1}, {"feature": "amount_vs_user_avg_ratio", "op": "gt", "value": 5.0}]}', 'FLAG', 'MEDIUM', 'Large transfer to a first-time recipient', 60),
('R007', 'Rooted Device', '{"AND": [{"feature": "device_is_rooted", "op": "eq", "value": 1}, {"feature": "txn_amount", "op": "gt", "value": 5000}]}', 'FLAG', 'MEDIUM', 'Transaction from a rooted/jailbroken device', 70),
('R008', 'VPN Detected', '{"AND": [{"feature": "device_vpn_flag", "op": "eq", "value": 1}]}', 'FLAG', 'LOW', 'Transaction routed through a VPN or proxy', 80),
('R009', 'Night High Value', '{"AND": [{"feature": "txn_is_night", "op": "eq", "value": 1}, {"feature": "txn_amount", "op": "gt", "value": 20000}]}', 'FLAG', 'MEDIUM', 'High-value transaction during unusual hours (12AM-5AM)', 90),
('R010', 'Emulator Detected', '{"AND": [{"feature": "device_is_emulator", "op": "eq", "value": 1}]}', 'FLAG', 'HIGH', 'Transaction originated from a device emulator', 25)
ON CONFLICT (rule_id) DO NOTHING;
