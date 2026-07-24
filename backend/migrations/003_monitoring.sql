-- =============================================================
-- SentinelPay Phase 8 — Model Monitoring & Drift Database Schema
-- =============================================================

CREATE TABLE IF NOT EXISTS model_metrics (
    id             BIGSERIAL PRIMARY KEY,
    model_id       VARCHAR(64) NOT NULL,
    period_start   TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end     TIMESTAMP WITH TIME ZONE NOT NULL,
    precision      DECIMAL(5, 4),
    recall         DECIMAL(5, 4),
    f1_score       DECIMAL(5, 4),
    auc_roc        DECIMAL(5, 4),
    total_samples  INTEGER DEFAULT 0,
    tp_count       INTEGER DEFAULT 0,
    fp_count       INTEGER DEFAULT 0,
    tn_count       INTEGER DEFAULT 0,
    fn_count       INTEGER DEFAULT 0,
    avg_latency_ms DECIMAL(8, 2),
    p99_latency_ms DECIMAL(8, 2),
    computed_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS drift_reports (
    id             BIGSERIAL PRIMARY KEY,
    feature_name   VARCHAR(64) NOT NULL,
    psi            DECIMAL(6, 4),
    alert_level    VARCHAR(16) DEFAULT 'OK',  -- OK, WARNING, CRITICAL
    baseline_mean  DECIMAL(12, 4),
    current_mean   DECIMAL(12, 4),
    computed_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_metrics_model_id ON model_metrics(model_id);
CREATE INDEX IF NOT EXISTS idx_metrics_period   ON model_metrics(computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_drift_feature    ON drift_reports(feature_name);
