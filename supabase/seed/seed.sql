-- Seed Data for Secure AIOps Observability Platform
-- Ref: architecture.md §6.3, §7.2, §8.1

-- ─── Default Tenant ─────────────────────────────────────────────────────────
INSERT INTO tenants (id, name, region, policy_json)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Acme Financial Corp',
    'ap-south-1',
    '{"sampling_rate": 1.0, "tumbling_window_s": 5, "retention_hours": 24}'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- ─── Enrolled Collector ─────────────────────────────────────────────────────
-- cred_hash is SHA-256 of 'test-collector-key-abc123'
INSERT INTO collectors (id, tenant_id, name, version, status, config_hash, cred_hash)
VALUES (
    '00000000-0000-0000-0000-000000000010',
    '00000000-0000-0000-0000-000000000001',
    'col-local-01',
    '1.0.0',
    'online',
    'cfg_a1b2c3d4',
    'c529a341f3e039e097a08aecadf1f51c89bca258c3dd43142bf26bdaeb6f47b3'
) ON CONFLICT (id) DO NOTHING;

-- ─── Pseudonymous Sources ───────────────────────────────────────────────────
INSERT INTO sources (id, tenant_id, collector_id, source_id_pseudo, kind, service_name)
VALUES
    ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', 'src_db_primary_01', 'database', 'db-primary'),
    ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', 'src_auth_svc_02', 'service', 'auth-service'),
    ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', 'src_api_gateway_03', 'gateway', 'api-gateway')
ON CONFLICT (id) DO NOTHING;

-- ─── Topology Dependency Edges ──────────────────────────────────────────────
-- Matches schema: dependency_edges(tenant_id, upstream_service, downstream_service)
INSERT INTO dependency_edges (tenant_id, upstream_service, downstream_service)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'api-gateway', 'auth-service'),
    ('00000000-0000-0000-0000-000000000001', 'auth-service', 'db-primary'),
    ('00000000-0000-0000-0000-000000000001', 'order-service', 'db-primary'),
    ('00000000-0000-0000-0000-000000000001', 'payment-service', 'db-primary')
ON CONFLICT (tenant_id, upstream_service, downstream_service) DO NOTHING;

-- ─── Runbooks (Catalog) ─────────────────────────────────────────────────────
INSERT INTO runbooks (id, title, body)
VALUES
    ('00000000-0000-0000-0000-000000000401', 'Kill Idle Connections & Expand Pool', 'EXEC_SQL: SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = ''idle'';'),
    ('00000000-0000-0000-0000-000000000402', 'Graceful Rolling Restart of Service', 'KUBECTL: rollout restart deployment/auth-service'),
    ('00000000-0000-0000-0000-000000000403', 'Horizontal Scale Replica Count', 'KUBECTL: scale deployment/api-gateway --replicas=+2'),
    ('00000000-0000-0000-0000-000000000404', 'Apply Rate Limiting on Ingress', 'WAF: set rate_limit 100/min on /api/v1/auth')
ON CONFLICT (id) DO NOTHING;

-- ─── Sample Incident ────────────────────────────────────────────────────────
INSERT INTO incidents (id, tenant_id, title, severity, status, root_cause_entity, confidence, explanation)
VALUES (
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000001',
    'Cascading Degradation rooted in db-primary',
    'critical',
    'open',
    'db-primary',
    0.85,
    'Cascading degradation caused by connection pool starvation on db-primary.'
) ON CONFLICT (id) DO NOTHING;

-- ─── Sample Recommendation ──────────────────────────────────────────────────
INSERT INTO recommendations (id, tenant_id, incident_id, action, rationale, score, status)
VALUES (
    '00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000201',
    'EXEC_SQL: SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = ''idle'';',
    'Database connection pool exhaustion detected. Runbook terminates idle backend workers.',
    0.95,
    'pending'
) ON CONFLICT (id) DO NOTHING;
