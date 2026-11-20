# Architecture: Secure Two-Tier AIOps Observability Platform

> CICADA 2026 hackathon. This document is the technical source of truth.
> Build order and checklists live in `task.md`.

---

## 1. What we are building (one paragraph)

A **Local Collector** runs inside the customer environment. It reads raw telemetry, redacts and drops anything sensitive, summarizes locally, and ships **only allow-listed metadata** over an authenticated, encrypted link to a **multi-tenant SaaS platform** (Supabase-backed). The SaaS side shows fleet health, detects anomalies with layered AI, merges related alerts into one incident, explains the likely cause, and proposes remediation behind a human-approval gate.

We are **not** building a better Grafana. We are building:

1. a privacy-enforcing collector (default-deny),
2. a provable, tenant-isolated metadata pipeline,
3. an explainable AIOps engine.

Dashboards are a thin layer on top.

### Design principles

| # | Principle | Meaning in practice |
|---|-----------|--------------------|
| P1 | **Default-deny egress** | Unknown fields are dropped. Redaction is the second layer, not the first. |
| P2 | **Prove it, don't claim it** | Egress log written *before* send; SaaS receipt matches it by payload ID. |
| P3 | **Explain everything** | Every flag/incident carries signals, scores, confidence, reasoning path. |
| P4 | **AI is layered** | Deterministic evidence first, ML scores second, LLM narration third. Each layer can be turned off. |
| P5 | **Fail safe** | SaaS down, bad data, late data: no loss, no duplicates, no silent stale values. |
| P6 | **Global from day one** | UTC + source timezone, event-time ordering, regional ingest, residency config. |

---

## 2. System overview

```
┌────────────────────────── TIER 1: CUSTOMER ENVIRONMENT (trust boundary) ──────────────────────────┐
│                                                                                                    │
│  Sources: servers · apps · network devices · security logs                                         │
│     │  (psutil agent, syslog UDP/TCP, SNMP poll, flow/ping probes, organizer stream)               │
│     ▼                                                                                              │
│  ┌─────────────────────────── LOCAL COLLECTOR ───────────────────────────┐                         │
│  │ 1 Ingest  →  2 Normalize  →  3 Redact  →  4 Local analyze  →          │                         │
│  │ 5 Aggregate  →  6 Policy + Allow-list  →  7 Egress log  →  8 Outbox   │                         │
│  └───────────────────────────────────────────────────────────────────────┘                         │
│     │            ▲                                                                                 │
│     │ raw store  │ local admin UI: raw-vs-sent view, egress panel, retention                       │
│     ▼            │                                                                                 │
│  Local encrypted store (SQLite/SQLCipher): raw logs (TTL), outbox, egress log                     │
└────────────────────────────────────────────┬───────────────────────────────────────────────────────┘
                                             │  HTTPS (TLS 1.3) + collector identity (mTLS or signed JWT)
                                             │  Only allow-listed JSON. Each payload has UUIDv7 ID.
                                             ▼
┌──────────────────────── TIER 2: CENTRAL SAAS (multi-tenant, metadata-only) ────────────────────────┐
│                                                                                                    │
│  Regional Ingest API (FastAPI)  →  schema re-validate (server-side allow-list)  →  dedupe by ID    │
│     │                                                                                              │
│     ▼                                                                                              │
│  Supabase Postgres (per region)  ── RLS on tenant_id ──  Realtime ──►  Web dashboard (Next.js)     │
│     │                                                                                              │
│     ├──► Stream detectors (fast, <2s): EWMA / robust z-score / seasonal baseline                   │
│     ├──► Async AIOps workers: Isolation Forest · forecasting · correlation · RCA                   │
│     ├──► Explanation service: evidence JSON → LLM narrator (metadata only) → validated text        │
│     ├──► Recommendation service: pgvector runbook RAG                                              │
│     └──► Remediation engine: policy check → approval → simulated action → audit → rollback         │
│                                                                                                    │
└────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Trust boundary and data classification

| Class | Examples | Where it lives | Leaves environment? |
|-------|----------|----------------|--------------------|
| **C3 Secret** | passwords, tokens, API keys, private keys, session IDs | Collector memory only (never persisted unredacted if avoidable) | **Never** |
| **C2 Sensitive raw** | raw log lines, request payloads, emails, usernames, IPs, hostnames, URLs | Collector local store, TTL-bound | **No** (only pseudonymized IDs or counts) |
| **C1 Derived metadata** | metric values, window aggregates, health state, event category, severity, short alert context, counts | Collector then SaaS | **Yes**, allow-listed only |
| **C0 Platform data** | tenant config, thresholds, incident records, audit log | SaaS | n/a |

**Rule:** a field leaves only if it is in the allow-list **and** its value passes the output validators (no regex hit for secret/PII patterns, length caps, enum checks).

---

## 4. Tier 1: Local Collector

### 4.1 Modules

| Module | Responsibility | Notes |
|--------|---------------|-------|
| `sources/` | Pluggable inputs | `host_metrics` (psutil), `syslog` listener, `snmp` poller (optional), `probe` (ICMP/TCP latency, packet loss), `replay` (organizer simulated stream) |
| `normalize/` | Convert everything to an internal `Event` | Adds `event_ts_utc`, `source_tz`, `source_id_raw` |
| `redact/` | Remove secrets/PII | Layered, see 4.2 |
| `analyze/` | Local detection | Failed-login window detector, local baseline, optional local LLM classifier |
| `aggregate/` | Windowed summaries | 1s/5s tumbling windows (kept small for the 10s p95 target) |
| `policy/` | Data policy engine | Per-tenant YAML: allow-list, sampling, retention, regions |
| `egress/` | Egress proof log | Append-only; stores exact bytes about to be sent + SHA-256 |
| `outbox/` | Durable queue | SQLite WAL; states `pending → sent → acked`; retry with exponential backoff and jitter |
| `transport/` | TLS client | mTLS or signed JWT; heartbeat every 10s |
| `admin_ui/` | Local-only UI (localhost) | Raw-vs-sent side-by-side, egress panel, collector config |

### 4.2 Redaction: defence in depth

1. **Allow-list schema (primary).** Pydantic model with `extra="forbid"`. Anything not declared is dropped, never sent.
2. **Structured redaction.** Known keys (`password`, `token`, `authorization`, `cookie`, `api_key`...) are removed regardless of value.
3. **Pattern scrubbing.** Regex and entropy checks (e.g. `detect-secrets` rules) for tokens, JWTs, AWS keys, card numbers (Luhn), emails, IPs.
4. **NER-based PII detection (optional, fancy).** Microsoft Presidio for names, phone numbers, addresses inside free text.
5. **Output validators.** Final gate: enums, length caps, regex deny-list. If a validator fails, the field is dropped and the event is flagged `redaction_failure` (the flag goes to SaaS, the content does not).
6. **Canary test.** Planted canary secrets (`CANARY-xxxx`) are injected in CI and live demo; any canary reaching SaaS fails the build.

**Pseudonymization:** `source_id = HMAC-SHA256(tenant_secret, hostname)` truncated. Plain hashes are brute-forceable; a keyed HMAC with a secret that stays local is not.

### 4.3 Local analysis (edge intelligence)

- **Failed-login detector:** sliding window per (pseudonymous) source; emits `{event:"auth_anomaly", count, window_s, severity, distinct_sources}` and never the raw auth records.
- **Local baseline:** EWMA + MAD per metric so the collector can tag `deviation_score` before sending.
- **Optional local LLM classifier (fancy, privacy win):** a small local model (e.g. via Ollama) classifies raw log lines into categories (`db_error`, `oom`, `timeout`, `auth_fail`, `disk_full`). Only the **category and count** leave. This lets us use LLM understanding of raw logs without any raw text leaving the environment.

### 4.4 Outbox and delivery

- Each payload gets a **UUIDv7** `payload_id` (time-sortable and unique) at creation, not at send time.
- Egress log entry is written **before** transmission, in the same SQLite transaction as the outbox row.
- On send failure: keep `pending`, back off (1s → 2s → 4s ... cap 60s, with jitter).
- On reconnect: drain oldest-first in batches; server returns per-ID `accepted | duplicate`; collector marks `acked`.
- Bounded buffer with policy (e.g. 24h or N MB); overflow policy is explicit (drop lowest severity first, record a `dropped_count` metadata event).

### 4.5 Collector security

- Enrollment: one-time token → collector gets a keypair and client cert (or a long-lived API key stored hashed server-side).
- Transport: TLS 1.3; optionally mTLS; server pins tenant and region from the credential, not from the payload.
- Local: raw store encrypted at rest (SQLCipher), retention TTL job, file permissions, no inbound ports except localhost admin UI.
- Audit: every config change and policy change recorded locally.

---

## 5. Payload contract (allow-listed)

```json
{
  "payload_id": "0190f3c2-7a1e-7b2d-9c1e-4f5a6b7c8d9e",
  "schema_version": "1.0",
  "tenant_id": "derived-server-side-from-credential",
  "collector_id": "col-blr-01",
  "region": "ap-south-1",
  "event_ts_utc": "2026-11-20T09:15:03.120Z",
  "source_tz": "Asia/Kolkata",
  "source_id": "h_8f3a1c9d2b7e",
  "kind": "metric_window | health | alert | security_summary | heartbeat",
  "window_s": 5,
  "metrics": { "cpu_pct": {"avg": 96.1, "max": 99.0}, "mem_pct": {"avg": 91.2}, "latency_ms": {"p95": 8000} },
  "category": "performance_degradation",
  "severity": "critical",
  "deviation": { "cpu_pct": 4.2 },
  "context": "CPU 4.2 sigma above baseline for 30s",
  "collector_meta": { "version": "0.3.1", "cpu_pct": 3.1, "mem_mb": 120, "config_hash": "ab12cd" }
}
```

Rules:
- `tenant_id` in the body is **ignored**; the server derives it from the authenticated credential.
- `context` is free text but length-capped (e.g. 200 chars) and re-scanned server-side.
- The SaaS validates against the **same schema** again (defence at both ends).

---

## 6. Tier 2: Central SaaS

### 6.1 Services

| Service | Tech | Job |
|---------|------|-----|
| **Ingest API** | FastAPI | AuthN (collector credential), server-side schema validation, dedupe, write to Postgres, publish to detectors |
| **Stream detectors** | Python workers | Fast per-metric baselines. Target alert in <15s from breach. |
| **AIOps workers** | Python (scikit-learn, statsmodels, networkx) | Multivariate anomaly, forecasting, correlation, RCA |
| **Explain service** | Python + `LLMClient` (Gemini by default) | Turns evidence JSON into a human explanation; validated against evidence |
| **Reco service** | Python + pgvector | Retrieves runbook steps; ranks remediation suggestions |
| **Remediation engine** | Python | Policy check, approval workflow, simulated executor, rollback, audit |
| **Web app** | Next.js + Supabase JS | Dashboards, incidents, egress panel, admin |

### 6.2 How Supabase is used

| Supabase feature | Our use |
|------------------|---------|
| **Postgres** | Core store: metrics, health, alerts, incidents, audit |
| **Row Level Security** | Tenant isolation enforced in the database, not just app code |
| **Auth** | Human users (operators, admins); custom claims carry `tenant_id` and `role` |
| **Realtime** | Push new metrics/alerts/incidents to dashboards without polling |
| **pgvector** | Runbook and past-incident embeddings for RAG recommendations |
| **Edge Functions** | Lightweight webhooks (e.g. notifications, approval callbacks) |
| **Storage** | Exported incident reports (PDF/MD) |
| **pg_cron** | Retention jobs, stale-data sweeps, collector-offline checks |

**Honest notes:**
- The Ingest API uses the **service role key server-side only**. Collectors never get Supabase keys; they authenticate to our Ingest API.
- Do not rely on any single extension without checking it is available on your Supabase Postgres version (e.g. TimescaleDB support has changed over time). Plan: **native time-partitioned tables + BRIN/btree indexes**; add a time-series extension only if it is available.
- **Residency simulation:** one Supabase project per region (e.g. `ap-south`, `eu-central`, `us-east`), plus a small control-plane table mapping `tenant → region → ingest URL`. Collectors get their regional URL at enrollment. Nothing replicates across projects.

### 6.3 Data model (core tables)

```
tenants(id, name, region, created_at, policy_json)
collectors(id, tenant_id, name, version, status, last_seen_at, config_hash, cred_hash)
sources(id, tenant_id, collector_id, source_id_pseudo, kind, service_name)       -- pseudonymous only
metrics(tenant_id, source_id, metric, event_ts_utc, source_tz, received_at,
        avg, max, p95, payload_id)                                               -- partitioned by event_ts_utc
payloads_seen(payload_id PRIMARY KEY, tenant_id, received_at, hash)              -- idempotency
health_state(tenant_id, entity_id, state, reason, signals_json, since_utc)
health_history(tenant_id, entity_id, from_state, to_state, reason, ts_utc)
alerts(id, tenant_id, source_id, category, severity, ts_utc, evidence_json, incident_id)
incidents(id, tenant_id, title, severity, status, root_cause_entity, confidence,
          explanation, evidence_json, opened_utc, closed_utc)
dependency_edges(tenant_id, upstream_service, downstream_service)
recommendations(id, tenant_id, incident_id, action, rationale, score, status)
remediations(id, tenant_id, incident_id, action, policy_result, approved_by,
             approved_at, executed_at, rollback_plan, rollback_status)
audit_log(id, tenant_id, actor, action, detail_json, ts_utc, prev_hash, hash)   -- hash-chained
egress_receipts(payload_id, tenant_id, collector_id, received_at, sha256)       -- matches collector egress log
runbooks(id, title, body, embedding vector(768))                                -- 768 dims, set by EMBEDDING_DIM
```

### 6.4 Tenant isolation

- Every tenant-owned table has `tenant_id uuid not null`.
- RLS enabled on **all** such tables. Example policy:

```sql
alter table alerts enable row level security;

create policy tenant_isolation on alerts
  for select using (
    tenant_id = (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::uuid
  );
```

- `tenant_id` goes in `app_metadata` (server-controlled), **not** `user_metadata` (user-editable).
- Automated cross-tenant test: log in as Tenant A, attempt to read/write Tenant B rows through REST, Realtime, and RPC. All must fail.
- Defence in depth: ingest API derives tenant from credential; Realtime channels filtered by RLS.

### 6.5 Ordering, dedupe, idempotency

- **Event-time ordering:** all queries/charts use `event_ts_utc`. `received_at` is stored only for latency measurement.
- **Late events:** accepted within a lateness window (e.g. 10 min); aggregates/health for affected buckets are recomputed; beyond the window they are stored but flagged `late`.
- **Idempotency:** `payloads_seen.payload_id` is a primary key. Insert uses `ON CONFLICT DO NOTHING`; response tells the collector `duplicate`.
- **Batch ack:** the server returns `{accepted:[ids], duplicate:[ids], rejected:[{id,reason}]}`.

---

## 7. AIOps engine (the "fancy AI", kept explainable)

### 7.1 Layer cake

```
Layer 0  Deterministic evidence      thresholds, rules, counts, dependency graph      (always on, fast)
Layer 1  Statistical baselines       EWMA, median/MAD z-score, hour-of-day baseline   (streaming, <2s)
Layer 2  ML anomaly models           Isolation Forest (multivariate), seasonal decomposition (STL)
Layer 3  Forecasting / foundation    Prophet or a pretrained time-series model (e.g. Chronos/TimesFM)
Layer 4  Correlation + RCA           time-window clustering, graph-based root-cause ranking
Layer 5  LLM narrator + RAG          explanation text and runbook-grounded recommendations
```

**Rule:** Layers 2-5 may *add* confidence and context; they may not remove evidence. If an ML or LLM service is down, Layers 0-1 still produce alerts and the UI shows `AI enrichment unavailable`.

### 7.2 Detection

| Technique | Catches | Why it beats a static threshold |
|-----------|---------|---------------------------------|
| EWMA + MAD z-score | Sudden spikes/drops | Adapts to level and noise per metric |
| Hour-of-day / day-of-week baseline | "85% CPU at 9 AM is normal" | Removes predictable seasonal noise |
| Isolation Forest (multivariate) | Odd *combinations* (CPU normal, but latency+errors high) | Looks across metrics together |
| Seasonal decomposition (STL) or Prophet | Trend/seasonality breaks | Separates pattern from anomaly |
| Forecast residual (Chronos/TimesFM, optional) | Deviation from predicted path, zero-shot on new series | Useful for cold-start tenants |
| Change-point detection (e.g. ruptures/CUSUM) | Level shifts after a deploy | Finds *when* behaviour changed |
| Packet-loss/latency rules + trend | Network degradation | Adds trend and impact context |

**Anomaly vs normal spike:** require persistence (N of M windows), compare with seasonal baseline, check for corroborating signals on related metrics, and apply a cool-down to stop flapping.

### 7.3 Correlation and incidents

1. **Candidate grouping:** alerts within a time window (e.g. 120s) on entities connected in the dependency graph.
2. **Clustering:** DBSCAN or graph connected-components over `(time, service, category)` features.
3. **Root-cause ranking:** on the dependency graph, score each node by (a) earliest anomaly onset, (b) upstream position, (c) cross-correlation lead over downstream metrics, (d) number of affected descendants. A personalized-PageRank walk over the anomaly subgraph is a good "fancy" ranking.
4. **Incident object:** `{title, severity, affected components, root_cause_candidate, ranked alternatives, confidence, evidence}`.
5. **Noise reduction metric:** `alerts_in / incidents_out`, shown on the dashboard.

Dependency map: configurable per tenant, seeded from the simulated topology (e.g. `db → app → api → web`). Optional learning of edges from lagged correlation, always shown as "inferred".

### 7.4 Explainability contract

Every anomaly and incident stores and shows:

```json
{
  "why_flagged": "cpu_pct 96.1 vs baseline 41.3 ± 6.2 (z = 8.9), sustained 30s",
  "contributing_signals": [
    {"signal": "cpu_pct", "score": 0.92, "direction": "up"},
    {"signal": "db_conn_errors", "score": 0.81, "direction": "up"},
    {"signal": "latency_p95", "score": 0.77, "direction": "up"}
  ],
  "reasoning_path": ["DB memory rose first (t0)", "DB errors began +12s", "App latency +20s", "API timeouts +31s"],
  "root_cause": {"entity": "db-primary", "confidence": 0.84},
  "alternatives": [{"entity": "app-1", "confidence": 0.09}],
  "recommended_action": "Investigate DB memory; consider scaling or restarting connection pool",
  "recommendation_basis": ["runbook:RB-014", "similar incident #INC-0217"],
  "model_versions": {"baseline": "ewma-1.2", "iforest": "1.0", "narrator": "llm-x"}
}
```

### 7.5 LLM narrator: safe by design

- **Provider:** Gemini via API key by default. The model ID is **never hard-coded**; it is read from env (`LLM_MODEL`). Everything goes through the `LLMClient` interface (see 7.7), so the provider can be swapped without touching detectors or UI.
- **Input:** only the structured evidence JSON (metadata). Never raw logs. It lives on the SaaS side, so it cannot leak what never arrived.
- **Output:** short explanation + suggested steps, in a fixed JSON format.
- **Grounding check:** every number/entity in the text must exist in the evidence JSON; otherwise discard and fall back to a template explanation.
- **Display:** the LLM text is shown *next to* the raw evidence panel, never instead of it.
- **Cost/latency:** the narrator runs async after the incident is created; the incident appears immediately with the template explanation, and the LLM text replaces it when ready.
- **RAG:** runbooks and past incidents embedded in pgvector; retrieval results are cited by ID in the recommendation.

### 7.6 LLM boundary rule

| Where | Model | May see raw data? |
|-------|-------|-------------------|
| Collector (Tier 1) | Local model via Ollama (open model) | Yes, it never leaves the environment |
| SaaS (Tier 2) | Gemini (cloud API) | **No**, metadata/evidence JSON only |

A cloud LLM must never be called from the collector. Add a CI check that greps `/collector` for any import of the cloud LLM client.

### 7.7 `LLMClient` abstraction and config

```python
class LLMClient(Protocol):
    def explain(self, evidence: dict) -> dict: ...   # returns validated JSON (explanation, steps)
    def embed(self, text: str) -> list[float]: ...   # returns EMBEDDING_DIM (768) floats
```

- Implementations: `GeminiClient` (default), `TemplateClient` (deterministic fallback, no network), optional others later.
- Circuit breaker: on timeout/429/error, switch to `TemplateClient` and show `AI enrichment unavailable`.
- Cache by hash of the evidence JSON to save prepaid credits.
- Log token usage per call to watch spend.
- Embedding dimension is fixed at **768** and must match `runbooks.embedding vector(768)`. Changing it means re-embedding all runbooks and a migration.

Env var **names** (values go in `.env`, never in the repo):

```
GEMINI_API_KEY=
LLM_PROVIDER=gemini
LLM_MODEL=                  # exact model ID from AI Studio
EMBEDDING_MODEL=            # exact embedding model ID
EMBEDDING_DIM=768
LLM_TIMEOUT_S=8
LLM_MAX_CALLS_PER_MIN=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=  # server-side only
LOCAL_LLM_MODEL=            # Ollama model for the collector
```

### 7.8 Latency budget (to meet the 10s p95 and 15s alert targets)

| Stage | Budget |
|-------|--------|
| Collector window + redact + send | ≤ 3s |
| Ingest validate + write | ≤ 1s |
| Stream detector → alert | ≤ 2s |
| Realtime push → render | ≤ 2s |
| **Total** | **≤ 8s** (headroom under 10s) |

Heavy models (Layers 2-5) run **off the hot path**; they enrich after the fast alert has already fired.

---

## 8. Health engine (Excellent / Good / Fair / Poor)

Computed per collector and per monitored entity. Thresholds are per-tenant and editable.

| State | Rule (illustrative, configurable) |
|-------|-----------------------------------|
| **Excellent** | Collector heartbeat < 30s old, all metrics inside baseline band |
| **Good** | Minor deviation (z between 2 and 3), no service impact |
| **Fair** | Sustained elevated latency/CPU/packet loss, or recurring warnings, or heartbeat 30-60s old |
| **Poor** | Collector silent > 60s, severe degradation (z > 4 plus impact), or critical security event |

- **Stale data:** if no data for `stale_after_s`, state is downgraded and shown as `STALE` with the last-seen time. Never display the last good value as if it were fresh.
- Every transition is written to `health_history` with UTC timestamp and a **reason string** listing the signals.
- Worst-state-wins rollup from entity to site to tenant.

---

## 9. Remediation and Autonomous Ops (simulated)

Roadmap: Observe → Detect → Correlate → Recommend → **Act (future)**.

Prototype flow for "Act":

```
Recommendation → Policy check (allowed? reversible? blast radius?) → Human approval →
Simulated executor (sandbox/mock) → Audit entry (hash-chained) → Rollback plan + rollback button
```

- Policy engine: simple rules or OPA (Rego). Example: `restart_service` is allowed for non-prod tags; `delete_*` is always denied.
- Autonomy level per tenant: `observe_only | recommend | approve_to_run | auto_safe` (default `recommend`).
- Every action has a defined inverse (rollback) before it can be approved.
- Audit log is append-only and hash-chained so tampering is detectable.

---

## 10. Frontend modules

| Module | Content |
|--------|---------|
| Overview | Fleet health grid, four-state counts, noise-reduction stat |
| Infrastructure | CPU/memory/disk/network per source |
| Application | Availability, latency, errors per service |
| Security | Failed-login summaries, risk indicators |
| Collector Health | Online/offline, last seen, version, resource use, config hash |
| AI Insights | Anomalies with evidence, incident cards, dependency graph (React Flow) |
| Recommendations | Ranked actions with rationale and approval buttons |
| **Egress Proof Panel** | Exact payload bytes per send, SHA-256, SaaS receipt match (green/red) |
| **Raw vs Sent** (collector admin UI) | Side-by-side raw log with secret vs redacted metadata |
| Customer Management | Tenants, regions, policies |
| Audit and Governance | Data transfers, access, approvals, rollbacks |
| Time/Region controls | Render in user timezone; show UTC and source TZ |

---

## 11. Tech stack

| Layer | Choice | Why |
|-------|--------|-----|
| Collector language | **Python 3.12** (asyncio) | Fast to build, same language as ML side; Go is an option if you want a single static binary |
| Collector libs | `psutil`, `pydantic v2`, `httpx`, `tenacity`, `aiosqlite`/`sqlcipher`, `detect-secrets`, `presidio-analyzer`, `pysnmp` (optional), `scapy`/`icmplib` (probes) | Real metrics, strict schemas, resilient delivery |
| Local LLM (optional) | **Ollama** + a small model | Classify raw logs locally; only category leaves |
| Local store | SQLite (WAL) / SQLCipher | Outbox + egress log + raw TTL store |
| Ingest + services | **FastAPI** + `uvicorn` | Typed, quick, good async |
| Database / platform | **Supabase** (Postgres, Auth, Realtime, RLS, pgvector, Storage, pg_cron, Edge Functions) | Covers auth, tenancy, realtime and vectors in one place |
| Queue (if needed) | Start with Postgres (`pgmq` or a jobs table); upgrade to **Redis Streams** or NATS JetStream | Keep infra small first |
| ML | `scikit-learn`, `statsmodels`, `prophet`, `ruptures`, `networkx`, `river` (online learning) | Explainable, well-known |
| Foundation TS model (optional) | Chronos / TimesFM (pretrained) | Zero-shot forecast baseline |
| LLM narrator / RAG | **Gemini API** (model ID from env, structured JSON output) + **768-dim** embeddings into pgvector, behind a swappable `LLMClient` | Metadata-only input; grounded output; prepaid key already available |
| Frontend | **Next.js** + TypeScript + Tailwind + shadcn/ui + ECharts/Recharts + React Flow | Fast dashboards, graph view |
| Realtime | Supabase Realtime | Push updates, meets latency target |
| Security | TLS 1.3, `step-ca`/OpenSSL for mTLS certs, Caddy/Traefik reverse proxy | Easy local TLS |
| Testing | `pytest`, `hypothesis`, Playwright, `locust`/`k6`, **Toxiproxy** (outage injection) | Prove reliability and latency |
| Containers / DevOps | **Docker + Docker Compose** (profiles, internal networks, healthchecks), pinned base images, hash-locked requirements per service, GitHub Actions building the same images, `.env` secrets, Makefile | No dependency conflicts; reproducible one-command demo; network layout shows the trust boundary |
| Simulator | Python generator with scripted fault injection, plus replay of the organizer stream | Reproducible scenarios |
| Optional | Grafana embedded for raw time-series panels | Allowed, but not the focus |

---

## 12. Repo layout

```
/collector
  /sources  /normalize  /redact  /analyze  /aggregate  /policy  /egress  /outbox  /transport  /admin_ui
/saas
  /ingest_api  /detectors  /aiops  /explain  /reco  /remediation
/web                      # Next.js app
/supabase
  /migrations  /policies  /seed  /functions
/simulator                # fault injector + organizer-stream replay
/tests
  /leak  /tenant_isolation  /outage  /ordering  /latency  /aiops
/docs  architecture.md  task.md  threat_model.md  demo_script.md
/docker                   # one Dockerfile + requirements.in + requirements.txt (hashed) per service
docker-compose.yml        # networks, profiles, healthchecks
.env.example  .dockerignore  Makefile  AGENTS.md
```

---

### 12.1 Containerized development and runtime (Docker-only rule)

**Rule:** nothing Python is installed on the host. Every service builds and runs in its own container, so there are no dependency conflicts between the collector, the SaaS services and the ML libraries.

**One image per service, one lockfile per image**

| Image | Contents | Notes |
|-------|----------|-------|
| `collector` | psutil, pydantic, httpx, SQLCipher, detect-secrets, (Presidio optional) | Small; runs in Tier 1 |
| `ingest-api` | FastAPI, uvicorn, supabase/psycopg client | Tier 2 |
| `aiops-core` | numpy, pandas, scikit-learn, statsmodels, networkx, river, ruptures | Streaming and batch detectors |
| `aiops-ml` | Prophet, torch + Chronos/TimesFM | **Heavy.** Kept separate so it never bloats or conflicts with the others. Model weights cached in a named volume |
| `explain` | Gemini SDK, httpx, pydantic | The only SaaS-side service that needs internet (LLM calls) |
| `simulator` | Python generator, fault injector | Dev/test only |
| `tests` | pytest, hypothesis, locust, Playwright | Runs the leak, RLS, outage and latency suites |
| `web` | Node LTS + Next.js | Frontend |
| 3rd-party | `ollama`, `toxiproxy`, `caddy`, Supabase local stack | Pinned versions |

**Dependency and image rules**
- Pin Python (`python:3.12-slim`, ideally by digest) and every base image; no `latest` tags.
- Each service has `requirements.in` (what we want) and a compiled `requirements.txt` with hashes (`pip-compile --generate-hashes` or `uv pip compile`). Images install with `--require-hashes`. `make lock` regenerates them *inside* a container.
- Multi-stage builds; run as a **non-root** user; read-only root filesystem where possible; add healthchecks; keep a `.dockerignore` (no `.env`, no `.git`).
- No secrets in images or Dockerfiles. Secrets come from `.env` via `env_file` at runtime; `.env.example` has names only.
- Multi-arch: confirm wheels exist for your machines (Intel vs Apple Silicon), especially for Prophet and torch.

**Compose networks double as the trust boundary** (a visible, demonstrable proof):

```
 customer_net (internal: true, no internet)   wan_net                      saas_net
 ┌──────────────────────────────────────┐   ┌───────────────────┐   ┌─────────────────────────────┐
 │ simulator · collector · ollama        │   │ toxiproxy (chaos) │   │ ingest-edge (Caddy/TLS)      │
 │ collector_raw volume (collector only) │───│                   │───│ ingest-api · detectors       │
 └──────────────────────────────────────┘   └───────────────────┘   │ aiops-core · aiops-ml · web  │
        collector joins customer_net + wan_net                      │ explain (+ egress to internet)│
                                                                    └─────────────────────────────┘
```

- `customer_net` is `internal: true`, so the raw-data side cannot reach the internet or any SaaS service directly.
- The only path out of the customer side is collector → `wan_net` → `ingest-edge`. Toxiproxy sits on that path to cut or slow the link for outage tests.
- The `collector_raw` volume is mounted **only** into the collector container. SaaS containers physically cannot read raw data. Show this in the demo with `docker compose config` and `docker inspect`.
- Supabase local (started by the Supabase CLI) runs in its own Docker network; attach the SaaS services to it as an external network, or reach it via the host gateway. Check the network name the CLI creates on your machine.

**Compose profiles** (start only what you need):

| Profile | Services |
|---------|----------|
| default / `core` | Supabase local, ingest, collector, simulator, web |
| `ai` | aiops-core, aiops-ml, explain |
| `edge-ai` | ollama (local model for the collector) |
| `chaos` | toxiproxy |
| `test` | tests runner |
| `regions` | extra regional ingest + second/third Supabase config |

**Dev ergonomics:** source bind-mounted into containers with `uvicorn --reload` (or `docker compose watch`). Make targets: `make build`, `make up`, `make down`, `make reset`, `make lock`, `make test`, `make leak-test`, `make shell-<service>`. All of them call Docker, never host Python.

**Container caveats (be honest with judges)**
- A collector container reads **host** metrics only if you give it access (`pid: host`, mount `/proc` and `/sys` read-only, and point psutil at it via `PROCFS_PATH`). On Docker Desktop (Mac/Windows) the "host" is a Linux VM, so numbers describe the VM. For the hackathon, treat the simulator/organizer stream as the primary source and real host metrics as a bonus.
- Ollama on CPU works for a small model but is slow; give Docker enough RAM or keep the local LLM for the edge-AI demo only.
- Docker adds startup time; use healthchecks and `depends_on: condition: service_healthy` so `make up` is reliable.

---

## 13. Reliability and performance mapping

| Requirement | Mechanism | Proof |
|-------------|-----------|-------|
| Collection → dashboard ≤ 10s p95 | Small windows, async heavy AI, Realtime | Latency histogram from event ts vs render ts |
| Breach → alert ≤ 15s | Streaming detector on hot path | Injected-spike test with timestamps |
| Offline detection ≤ 60s | Heartbeat + pg_cron sweep | Kill collector, record state change time |
| Zero loss / zero dupes after outage | Outbox + UUIDv7 + `ON CONFLICT` | Compare sent-ID set vs received-ID set after reconnect |
| Out-of-order correctness | Event-time queries + late window | Shuffle test; trends unchanged |
| Tenant isolation | RLS + derived tenant | Cross-tenant attack test suite |

---

## 14. Threat model (short)

| Threat | Mitigation |
|--------|-----------|
| Secret slips into payload | Default-deny schema, scrubbers, output validators, canary tests, server-side re-scan |
| Rogue collector / spoofed tenant | Credential-derived tenant, mTLS/API key, rate limits |
| Replay/duplicate flood | Payload ID idempotency, timestamps sanity, rate limit |
| Cross-tenant read | RLS, `app_metadata` claims, automated attack tests |
| LLM prompt injection via metadata text | Only structured fields to LLM, `context` length-capped and sanitized, grounding check on output |
| Tampered audit | Hash chain, append-only |
| Pseudonym reversal | Keyed HMAC, secret stays local |
| Supply-chain / dependency risk | Hash-locked requirements, pinned images, non-root containers, image/dependency scan in CI |

---

## 15. Known limitations (say these plainly to judges)

- Regex/NER redaction is probabilistic; the **allow-list is the real guarantee**.
- Data residency is **simulated** with separate projects and routing, not a legal compliance claim.
- ML models are trained on **simulated** data; real-world accuracy would need tenant-specific tuning and labelled incidents.
- Dependency graph is configured/seeded; learned edges are suggestions, not truth.
- Autonomous actions are simulated, with human approval.
- Docker network separation demonstrates the trust boundary in a lab; a real deployment would also need host/network hardening, not just containers.
- Local SQLite outbox is single-node; production would use a hardened queue and key management (KMS/HSM).

---

## 16. Judging map

| Phase | Marks | What in this architecture earns it |
|-------|-------|------------------------------------|
| 1 Problem understanding | 10 | Sections 1, 3, 5 and the use-case list in `task.md` |
| 2 Architecture and design | 25 | Sections 2, 4, 6, 7, 13, 14 |
| 3 Working prototype | 35 | Collector, egress panel, tenant isolation, outbox, health states, measured latency |
| 4 Final demo | 30 | Explainability contract (7.4), incident merge, live scenarios, limitations (15) |
