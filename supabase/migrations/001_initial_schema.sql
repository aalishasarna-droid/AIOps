-- Migration: Initial schema for the AIOps Observability Platform
-- Ref: architecture.md §6.3

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
-- pgvector for runbook embeddings (768 dimensions)
CREATE EXTENSION IF NOT EXISTS "vector";

-- ─── Tenants ────────────────────────────────────────────────────────────

CREATE TABLE tenants (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    region      TEXT NOT NULL DEFAULT 'ap-south-1',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    policy_json JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- ─── Collectors ─────────────────────────────────────────────────────────

CREATE TABLE collectors (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id),
    name        TEXT NOT NULL,
    version     TEXT,
    status      TEXT NOT NULL DEFAULT 'online',  -- online | offline | stale
    last_seen_at TIMESTAMPTZ,
    config_hash TEXT,
    cred_hash   TEXT NOT NULL,  -- hashed API key
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_collectors_tenant ON collectors(tenant_id);

-- ─── Sources (pseudonymous) ─────────────────────────────────────────────

CREATE TABLE sources (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    collector_id    UUID NOT NULL REFERENCES collectors(id),
    source_id_pseudo TEXT NOT NULL,  -- HMAC-pseudonymized
    kind            TEXT,
    service_name    TEXT
);

CREATE INDEX idx_sources_tenant ON sources(tenant_id);
CREATE UNIQUE INDEX idx_sources_pseudo ON sources(tenant_id, source_id_pseudo);

-- ─── Metrics (partitioned by event time) ────────────────────────────────

CREATE TABLE metrics (
    tenant_id    UUID NOT NULL,
    source_id    TEXT NOT NULL,
    metric       TEXT NOT NULL,
    event_ts_utc TIMESTAMPTZ NOT NULL,
    source_tz    TEXT,
    received_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    avg          DOUBLE PRECISION,
    max          DOUBLE PRECISION,
    p95          DOUBLE PRECISION,
    payload_id   TEXT NOT NULL
) PARTITION BY RANGE (event_ts_utc);

-- Create initial partitions (add more as needed)
CREATE TABLE metrics_2026_11 PARTITION OF metrics
    FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE metrics_2026_12 PARTITION OF metrics
    FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

CREATE INDEX idx_metrics_tenant_ts ON metrics(tenant_id, event_ts_utc);
CREATE INDEX idx_metrics_source_ts ON metrics(source_id, event_ts_utc);

-- ─── Payload deduplication ──────────────────────────────────────────────

CREATE TABLE payloads_seen (
    payload_id  TEXT PRIMARY KEY,
    tenant_id   UUID NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    hash        TEXT NOT NULL  -- SHA-256 of payload bytes
);

-- ─── Health ─────────────────────────────────────────────────────────────

CREATE TABLE health_state (
    tenant_id   UUID NOT NULL,
    entity_id   TEXT NOT NULL,
    state       TEXT NOT NULL DEFAULT 'Excellent',  -- Excellent | Good | Fair | Poor
    reason      TEXT,
    signals_json JSONB,
    since_utc   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, entity_id)
);

CREATE TABLE health_history (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    entity_id   TEXT NOT NULL,
    from_state  TEXT NOT NULL,
    to_state    TEXT NOT NULL,
    reason      TEXT,
    ts_utc      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_health_history_tenant ON health_history(tenant_id, ts_utc);

-- ─── Alerts ─────────────────────────────────────────────────────────────

CREATE TABLE alerts (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL,
    source_id     TEXT,
    category      TEXT,
    severity      TEXT NOT NULL DEFAULT 'info',
    ts_utc        TIMESTAMPTZ NOT NULL DEFAULT now(),
    evidence_json JSONB,
    incident_id   UUID  -- nullable until correlated
);

CREATE INDEX idx_alerts_tenant_ts ON alerts(tenant_id, ts_utc);
CREATE INDEX idx_alerts_incident ON alerts(incident_id);

-- ─── Incidents ──────────────────────────────────────────────────────────

CREATE TABLE incidents (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id         UUID NOT NULL,
    title             TEXT NOT NULL,
    severity          TEXT NOT NULL DEFAULT 'info',
    status            TEXT NOT NULL DEFAULT 'open',  -- open | investigating | resolved | closed
    root_cause_entity TEXT,
    confidence        DOUBLE PRECISION,
    explanation       TEXT,
    evidence_json     JSONB,
    opened_utc        TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_utc        TIMESTAMPTZ
);

CREATE INDEX idx_incidents_tenant ON incidents(tenant_id, opened_utc);

-- ─── Dependency graph ───────────────────────────────────────────────────

CREATE TABLE dependency_edges (
    tenant_id          UUID NOT NULL,
    upstream_service   TEXT NOT NULL,
    downstream_service TEXT NOT NULL,
    PRIMARY KEY (tenant_id, upstream_service, downstream_service)
);

-- ─── Recommendations ───────────────────────────────────────────────────

CREATE TABLE recommendations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    incident_id UUID REFERENCES incidents(id),
    action      TEXT NOT NULL,
    rationale   TEXT,
    score       DOUBLE PRECISION,
    status      TEXT NOT NULL DEFAULT 'pending'  -- pending | approved | denied | executed
);

-- ─── Remediations ───────────────────────────────────────────────────────

CREATE TABLE remediations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    incident_id     UUID REFERENCES incidents(id),
    action          TEXT NOT NULL,
    policy_result   TEXT,
    approved_by     UUID,
    approved_at     TIMESTAMPTZ,
    executed_at     TIMESTAMPTZ,
    rollback_plan   TEXT,
    rollback_status TEXT  -- null | pending | completed | failed
);

-- ─── Audit log (hash-chained) ───────────────────────────────────────────

CREATE TABLE audit_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL,
    actor       TEXT NOT NULL,
    action      TEXT NOT NULL,
    detail_json JSONB,
    ts_utc      TIMESTAMPTZ NOT NULL DEFAULT now(),
    prev_hash   TEXT,
    hash        TEXT NOT NULL
);

CREATE INDEX idx_audit_tenant ON audit_log(tenant_id, ts_utc);

-- ─── Egress receipts ───────────────────────────────────────────────────

CREATE TABLE egress_receipts (
    payload_id   TEXT PRIMARY KEY,
    tenant_id    UUID NOT NULL,
    collector_id UUID,
    received_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    sha256       TEXT NOT NULL
);

-- ─── Runbooks (with vector embeddings for RAG) ─────────────────────────

CREATE TABLE runbooks (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title     TEXT NOT NULL,
    body      TEXT NOT NULL,
    embedding vector(768)  -- EMBEDDING_DIM = 768
);

CREATE INDEX IF NOT EXISTS idx_runbooks_embedding ON runbooks USING hnsw (embedding vector_cosine_ops);
