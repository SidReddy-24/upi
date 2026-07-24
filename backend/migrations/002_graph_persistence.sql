-- =============================================================
-- SentinelPay Phase 1.2 — Graph Persistence Schema Migration
-- =============================================================

CREATE TABLE IF NOT EXISTS graph_edges (
    id           BIGSERIAL PRIMARY KEY,
    sender       VARCHAR(128) NOT NULL,
    receiver     VARCHAR(128) NOT NULL,
    amount       DECIMAL(15, 2) DEFAULT 0.0,
    txn_id       VARCHAR(64),
    edge_type    VARCHAR(32) DEFAULT 'TRANSFERRED',
    created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS graph_nodes (
    node_id      VARCHAR(128) PRIMARY KEY,
    node_type    VARCHAR(32) NOT NULL,    -- User, VPA, Device
    fraud_flag   BOOLEAN DEFAULT FALSE,
    pagerank     DECIMAL(10, 8) DEFAULT 0.0,
    risk_score   DECIMAL(5, 4) DEFAULT 0.0,
    updated_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_graph_edges_sender   ON graph_edges(sender);
CREATE INDEX IF NOT EXISTS idx_graph_edges_receiver ON graph_edges(receiver);
CREATE INDEX IF NOT EXISTS idx_graph_edges_created  ON graph_edges(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_fraud    ON graph_nodes(fraud_flag) WHERE fraud_flag = TRUE;
