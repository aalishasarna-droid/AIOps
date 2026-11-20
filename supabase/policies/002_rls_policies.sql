-- RLS policies — tenant isolation enforced at the database level
-- Ref: architecture.md §6.4
--
-- tenant_id is in app_metadata (server-controlled), NOT user_metadata (user-editable).
-- RLS ensures that even if application code has a bug, cross-tenant reads are impossible.

-- ─── Enable RLS on all tenant-scoped tables ────────────────────────────

ALTER TABLE collectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE payloads_seen ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE dependency_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE remediations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE egress_receipts ENABLE ROW LEVEL SECURITY;

-- ─── Policies ──────────────────────────────────────────────────────────

-- Helper: extract tenant_id from JWT app_metadata
-- Usage: (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid

-- Collectors
CREATE POLICY tenant_isolation ON collectors
    FOR ALL USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- Sources
CREATE POLICY tenant_isolation ON sources
    FOR ALL USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- Metrics
CREATE POLICY tenant_isolation ON metrics
    FOR ALL USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- Payloads seen
CREATE POLICY tenant_isolation ON payloads_seen
    FOR ALL USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- Health state
CREATE POLICY tenant_isolation ON health_state
    FOR ALL USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- Health history
CREATE POLICY tenant_isolation ON health_history
    FOR ALL USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- Alerts
CREATE POLICY tenant_isolation ON alerts
    FOR ALL USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- Incidents
CREATE POLICY tenant_isolation ON incidents
    FOR ALL USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- Dependency edges
CREATE POLICY tenant_isolation ON dependency_edges
    FOR ALL USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- Recommendations
CREATE POLICY tenant_isolation ON recommendations
    FOR ALL USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- Remediations
CREATE POLICY tenant_isolation ON remediations
    FOR ALL USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- Audit log
CREATE POLICY tenant_isolation ON audit_log
    FOR ALL USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- Egress receipts
CREATE POLICY tenant_isolation ON egress_receipts
    FOR ALL USING (tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid);

-- Note: The service role key bypasses RLS (by design).
-- The ingest API uses the service role key server-side.
-- Collectors never get Supabase keys; they authenticate to our Ingest API.
