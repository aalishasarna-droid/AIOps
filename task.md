# Task Plan: Secure AIOps Observability Platform

> Companion to `architecture.md`. Work top to bottom. Do **not** start a phase's "Fancy" items until its **Gate** passes.
> Time is flexible: each phase lists a relative size (S/M/L) instead of fixed hours. Scale to the time you really have.

**Legend:** `[ ]` todo · `[x]` done · **P0** must-have · **P1** should-have · **P2** fancy/bonus
**Roles (adjust to team size):** **C** Collector · **S** SaaS/Backend/DB · **A** AIOps/ML · **F** Frontend · **Q** Test/Demo (everyone shares)

---

## Roadmap at a glance

| Phase | Name | Priority | Size | Output |
|-------|------|----------|------|--------|
| 0 | Setup and contracts | P0 | S | Repo, schema, simulator, threat model |
| 1 | Collector core | P0 | M | Collect → redact → allow-list → egress log |
| 2 | SaaS ingest and tenant isolation | P0 | M | Ingest API, Supabase schema, RLS |
| 3 | Dashboard and health states | P0 | M | Four-state health, egress panel, collector health |
| 4 | Reliability and delivery | P0 | M | Outbox, outage, idempotency, ordering, latency proof |
| **MVP GATE** | Demo-able core | | | **Everything a judge must see** |
| 5 | Baseline AIOps | P0/P1 | M | Statistical anomalies, correlation, explanation |
| 6 | Advanced AI | P2 (fancy) | L | ML models, forecasting, LLM narrator, RAG, local LLM |
| 7 | Global-ready and Autonomous Ops sim | P1 | M | Regions, timezones, approval/rollback |
| 8 | Hardening, tests, demo, presentation | P0 | M | Scenario rehearsal, docs, slides |

**Cut line** if time runs short, drop in this order: Phase 6 local LLM → Phase 6 foundation model → Phase 6 RAG → Phase 7 regions → Phase 6 Isolation Forest. Never drop Phases 0-5 or 8.

---

## Phase 0: Setup and Contracts (P0, size S)

Goal: everyone builds against the same contracts.

- [x] **0.1** Create repo and layout from `architecture.md` §12 (all)
- [x] **0.2** Docker Compose skeleton per `architecture.md` §12.1: `customer_net` (internal), `wan_net`, `saas_net`; services collector, ingest-api, web, simulator; profiles `core/ai/edge-ai/chaos/test` (S)
- [x] **0.3** Write the **payload JSON schema** and allow-list v1 (`schema_version`) (`collector/schemas.py`) (C+S)
- [x] **0.4** Write **data classification table** (`docs/data_classification.md`) (all)
- [x] **0.5** One-page **trust-boundary diagram** with every network hop labelled (`docs/trust_boundary.md`) (all)
- [x] **0.6** Build **simulator** v1: host metrics, syslog lines with **planted secrets** (`CANARY-...`), failed-login bursts, latency spikes (`simulator/generator.py`) (A)
- [x] **0.7** Add scenario scripts: `spike`, `memory_leak`, `db_outage_cascade`, `login_burst`, `net_latency` (`simulator/runner.py`) (A)
- [x] **0.8** Add a **replay adapter** for the organizer-provided stream (`collector/sources/replay.py`) (C+A)
- [x] **0.9** Draft `threat_model.md` from `architecture.md` §14 (`docs/threat_model.md`) (S)
- [x] **0.10** Define 4 main use cases + minimum viable demo statement (`docs/use_cases.md`) (all)
- [x] **0.11** Makefile targets: `make build`, `make up`, `make down`, `make reset`, `make lock`, `make demo`, `make test`, `make leak-test` (`Makefile`)
- [x] **0.12** `.env.example` with the env var **names**; `.env` in `.gitignore` (S)
- [x] **0.13** `LLMClient` interface + `TemplateClient` stub (`saas/explain/llm_client.py`) (A)
- [x] **0.14** `AGENTS.md` coding agent rules: contracts, folder boundaries, containers-only rule (all)
- [x] **0.15** CI check: fail if `/collector` imports the cloud LLM client or contains secrets (`tests/test_ci.py`) (Q)
- [x] **0.16** One `Dockerfile` per service under `/docker`: pinned Python 3.12-slim, multi-stage, non-root, healthcheck (all)
- [x] **0.17** `requirements.in` per service + `requirements.txt` (all)
- [x] **0.18** Separate heavy ML image `aiops-ml` Dockerfile with named volume for model weights (A)
- [x] **0.19** `.dockerignore` (excludes `.env`, `.git`, caches) (all)
- [x] **0.20** Compose healthchecks + `depends_on: condition: service_healthy` (S)
- [x] **0.21** Mount `collector_raw` volume into collector only; test asserting isolation (`tests/test_ci.py`) (Q)
- [x] **0.22** Image templates & local execution support ready (all)

**Gate 0:** on a **fresh clone**, `make up` builds and starts all services in Docker with no host-installed Python packages; simulator emits events; schema reviewed by everyone.

---

## Phase 1: Collector Core (P0, size M)

Goal: raw data in, safe metadata out, with proof.

**Sources**
- [x] **1.1** `host_metrics` source with `psutil`: CPU, memory, disk, network bandwidth (`collector/sources/host.py`) (C)
- [x] **1.2** `probe` source: latency and packet loss (ICMP/TCP) (`collector/sources/probe.py`) (C)
- [x] **1.3** `syslog` listener + file tail (`collector/sources/syslog.py`) (C)
- [x] **1.4** `replay` source for organizer stream (`collector/sources/replay.py`) (C)
- [x] **1.5** Normalizer: internal `Event` with `event_ts_utc`, `source_tz`, raw source ID (`collector/normalize/normalizer.py`) (C)

**Protection**
- [x] **1.6** Pydantic allow-list models with `extra="forbid"` (default-deny) (`collector/schemas.py`) (C)
- [x] **1.7** Key-based redaction (`password`, `token`, `authorization`, `cookie`, ...) (`collector/redact/scrubbers.py`) (C)
- [x] **1.8** Pattern scrubbers: JWT, API keys, AWS keys, emails, IPs, card numbers (`collector/redact/scrubbers.py`) (C)
- [x] **1.9** Pseudonymization with **per-tenant keyed HMAC** for source IDs (`collector/redact/pseudonym.py`) (C)
- [x] **1.10** Output validators (enums, length caps, final regex deny-list) (`collector/redact/validator.py`) (C)
- [x] **1.11** Policy engine: per-tenant YAML for allow-list, retention, sampling (`collector/policy/engine.py`) (C)

**Local processing**
- [x] **1.12** Windowed aggregation (1s/5s tumbling) (`collector/aggregate/window.py`) (C)
- [x] **1.13** **Failed-login detector** (sliding window) emitting summary `{count, window, severity}` (`collector/analyze/failed_login.py`) (C)
- [x] **1.14** Local EWMA deviation score per metric (`collector/analyze/ewma.py`) (C+A)
- [x] **1.15** Local raw store with TTL and transactional outbox (`collector/outbox/store.py`) (C)

**Proof**
- [x] **1.16** **Egress log**: exact serialized payload + SHA-256, written before send (`collector/egress/logger.py`) (C)
- [x] **1.17** Local admin UI (localhost only): **Raw vs Sent side-by-side** and egress log viewer (`collector/admin_ui/server.py`) (C+F)

**Tests**
- [x] **1.18** Leak test: inject 50+ canary secrets in different formats; assert **zero** appear in any outgoing payload (`tests/leak/test_leak.py`) (Q)
- [x] **1.19** Unit tests for each scrubber, including tricky cases (`tests/leak/test_scrubbers.py`) (Q)

**Gate 1:** Live demo: a raw log with a password appears on the collector UI; the egress log shows a payload without it; leak test passes.

---

## Phase 2: SaaS Ingest and Tenant Isolation (P0, size M)

Goal: receive only valid metadata, separated per tenant.

**Supabase**
- [x] **2.1** Migrations for tables in `architecture.md` §6.3 (`supabase/migrations/001_initial_schema.sql`) (S)
- [x] **2.2** Partition `metrics` by `event_ts_utc` + indexes (`supabase/migrations/001_initial_schema.sql`) (S)
- [x] **2.3** Enable **RLS** on every tenant table + policies using `app_metadata.tenant_id` (`supabase/policies/002_rls_policies.sql`) (S)
- [x] **2.4** Supabase Auth: roles (`admin`, `operator`, `viewer`) with claims set server-side (S)
- [x] **2.5** Seed: tenants, users, collectors (`supabase/seed/seed.sql`) (S)

**Ingest API (FastAPI)**
- [x] **2.6** Collector enrollment: credential hashing & API key auth (`saas/ingest_api/main.py`) (S+C)
- [x] **2.7** `POST /ingest` batch endpoint: authenticate, derive `tenant_id` from credential (`saas/ingest_api/main.py`) (S)
- [x] **2.8** Server-side schema validation (same allow-list) + `context` rescan; reject unknown fields (`saas/ingest_api/main.py`) (S)
- [x] **2.9** Idempotent insert using `payloads_seen` tracking; return `accepted/duplicate/rejected` (`saas/ingest_api/main.py`) (S)
- [x] **2.10** Store `event_ts_utc`, `source_tz`, `received_at` separately (S)
- [x] **2.11** `egress_receipts` table & SaaS SHA-256 receipt generation (S)
- [ ] **2.12** TLS in front of the API (Caddy/Traefik reverse proxy), TLS 1.3 (S)

**Tests**
- [ ] **2.13** **Cross-tenant attack test** via live cloud Supabase REST/Realtime/RPC (Q+S)
- [x] **2.14** Send payload with extra field / forged `tenant_id`; assert rejected/ignored (`tests/tenant_isolation/test_auth_and_isolation.py`) (Q)

**Gate 2:** Collector sends to SaaS; only allow-listed fields visible in DB; Tenant A cannot see Tenant B in any channel.

---

## Phase 3: Dashboard and Health States (P0, size M)

Goal: judges can *see* it working.

- [x] **3.1** Web app with tenant-scoped data & FastAPI host (`web/index.html`, `saas/ingest_api/main.py`) (F)
- [ ] **3.2** Cloud Supabase Realtime subscriptions (F)
- [x] **3.3** **Health engine** (Healthy/Degraded/Critical/Stale) with configurable thresholds (`saas/detectors/health.py`) (S+A)
- [x] **3.4** Reason string for every state, listing contributing signals (`saas/detectors/health.py`) (S)
- [x] **3.5** **Stale-data downgrade** (no silent last-good value) + `STALE` badge (`saas/detectors/health.py`, `web/index.html`) (S+F)
- [x] **3.6** `health_history` event log with UTC timestamps (`supabase/migrations/001_initial_schema.sql`) (S+F)
- [x] **3.7** Overview page: fleet health grid, four-state counts (`web/index.html`) (F)
- [x] **3.8** Infrastructure page: CPU, memory, disk, bandwidth, latency charts (`web/index.html`) (F)
- [x] **3.9** Security page: failed-login summaries/risk indicator (`web/index.html`) (F)
- [x] **3.10** **Collector Health page**: online/offline, last seen, version, resource use (`web/index.html`) (F)
- [x] **3.11** **Egress Proof Panel** in the SaaS UI: payload list with SHA-256 matching hashes (`web/index.html`) (F+S)
- [ ] **3.12** pg_cron job in Supabase: mark collectors offline within 60s of last heartbeat (S)
- [x] **3.13** Settings & scenario switching for thresholds (`web/index.html`) (S+F)

**Gate 3:** Start simulator → live dashboard updates; kill collector → state turns Poor within 60s with reason; egress panel shows matching hashes.

---

## Phase 4: Reliability and Delivery (P0, size M)

Goal: measured, not claimed (10 of the 35 Phase-3 marks).

- [x] **4.1** SQLite **outbox** with states `pending/sent/failed` (`collector/outbox/store.py`) (C)
- [x] **4.2** Retry with exponential backoff (`collector/transport/sender.py`, `collector/main.py`) (C)
- [x] **4.3** Drain after reconnect: oldest-first, batched, resume (`collector/outbox/store.py`) (C)
- [x] **4.4** Bounded buffer + TTL retention pruning (`collector/outbox/store.py`) (C)
- [x] **4.5** Heartbeat sender with collector meta (`collector/schemas.py`, `collector/main.py`) (C)
- [x] **4.6** Late-event window: separate received_at and event_ts_utc (`collector/schemas.py`, `saas/ingest_api/main.py`) (S)
- [x] **4.7** Chart/health queries use **event time**, never arrival time (S+F)
- [ ] **4.8** **Outage test with Toxiproxy**: cut link N minutes → reconnect → assert 0 lost, 0 dup (Q)
- [ ] **4.9** Out-of-order shuffle test: trends unchanged (Q)
- [x] **4.10** Duplicate-flood test (same payload ×100) → idempotent (`tests/tenant_isolation/test_auth_and_isolation.py`) (Q)
- [ ] **4.11** Latency measurement harness: event timestamp vs dashboard render time (Q)
- [ ] **4.12** Spike→alert timing harness (target ≤15s) (Q)
- [ ] **4.13** Load test with locust/k6: many collectors × tenants (Q+S)
- [x] **4.14** Reliability & verification guide section (`DEPLOYMENT_AND_RUN_GUIDE.md`) (Q)

**Gate 4 (MVP GATE):** all of these demonstrable live, in order:
1. Secret in raw log → absent from SaaS
2. Egress panel shows exact payload; SaaS receipt hash matches
3. Four health states with reasons and stale handling
4. Outage → buffer → resume with 0 lost, 0 duplicates
5. Tenant A cannot see Tenant B
6. p95 latency and alert time measured and recorded

> Stop and rehearse this before touching Phase 5+. This is the foundation of Phase 1-3 marks.

---

## Phase 5: Baseline AIOps (P0/P1, size M)

Goal: AI that is beyond static thresholds and fully explainable.

**Detection**
- [x] **5.1** Per-metric **EWMA + deviation z-score** streaming detector (`collector/analyze/ewma.py`) (A)
- [x] **5.2** **Hour-of-day diurnal baseline** in simulator (`simulator/generator.py`) (A)
- [x] **5.3** Persistence rule + cool-down to prevent flapping (`collector/analyze/failed_login.py`) (A)
- [x] **5.4** Network probe trend detection (`collector/sources/probe.py`) (A)
- [x] **5.5** Security risk indicator from failed-login summaries (`collector/analyze/failed_login.py`, `web/index.html`) (A)

**Correlation**
- [x] **5.6** Tenant **dependency graph** table & seeded topology DAG (`saas/aiops/topology.py`, `supabase/seed/seed.sql`) (A+S)
- [x] **5.7** Time-window + graph-based alert grouping into **incidents** (`saas/aiops/correlator.py`) (A)
- [x] **5.8** Root-cause ranking: upstream topological dependency traversal (`saas/aiops/correlator.py`) (A)
- [x] **5.9** Noise-reduction alert coalescence (`saas/aiops/correlator.py`, `web/index.html`) (A+F)

**Explainability (weighted higher in Phase 4 judging)**
- [x] **5.10** Store the explainability contract (`architecture.md` §7.4) (`saas/explain/narrator.py`) (A+S)
- [x] **5.11** **Template explanation** engine (deterministic, no LLM) (`saas/explain/llm_client.py`) (A)
- [x] **5.12** Incident card UI: why flagged, contributing signals, reasoning path, alternatives (`web/index.html`) (F)
- [x] **5.13** Recommendation v1: runbook mapping (`saas/reco/engine.py`) (A)

**Tests**
- [x] **5.14** Scenario suite: `spike`, `memory_leak`, `db_outage_cascade`, `login_burst`, `net_latency` (`simulator/runner.py`) (A+Q)
- [ ] **5.15** Measure precision/recall/false-alarm rate benchmark harness (A+Q)

**Gate 5:** `db_outage_cascade` produces **1 incident** (not 5 alerts) naming the DB as root cause with evidence; `normal_peak` produces none.

---

## Phase 6: Advanced AI (P2, size L)

Goal: the "fancy AI" you asked for, **on top of** Phase 5, never replacing it. Each item has a fallback to Phase 5.

**6A. ML anomaly detection**
- [ ] **6.1** **Isolation Forest** multivariate detector over windowed features (A)
- [ ] **6.2** Seasonal decomposition (STL) / **Prophet** baseline; residual anomaly scoring (A)
- [ ] **6.3** **Change-point detection** (ruptures/CUSUM) to mark "when behaviour changed" (A)
- [ ] **6.4** Online learning with `river` (adaptive baselines per tenant) (A)
- [ ] **6.5** Model registry table: version, trained-on window, params; show `model_versions` in explanations (A+S)
- [ ] **6.6** Per-signal contribution scores (e.g. feature-level deviation or SHAP for the forest) (A)

**6B. Foundation / forecasting model**
- [ ] **6.7** Zero-shot forecasting with a pretrained time-series model (Chronos/TimesFM) for cold-start tenants; runs in the `aiops-ml` image with weights cached in a volume (A)
- [ ] **6.8** Forecast-residual anomaly score + "predicted vs actual" chart (A+F)
- [ ] **6.9** Capacity forecast: "disk full in N hours" (A)

**6C. Advanced correlation and RCA**
- [ ] **6.10** Cross-correlation with lag to infer lead/lag between metrics (A)
- [ ] **6.11** DBSCAN / graph clustering on alert features (A)
- [ ] **6.12** **Personalized-PageRank root-cause ranking** on the anomaly subgraph (A)
- [ ] **6.13** Inferred dependency edges from lagged correlation, shown as "inferred" (A)
- [ ] **6.14** Incident deduplication across time (same pattern recurring) (A)

**6D. LLM narrator and RAG (metadata only)**
- [x] **6.15** Implement `GeminiClient` behind `LLMClient`: evidence JSON → Gemini API with structured JSON output (`saas/explain/gemini_client.py`) (A+S)
- [x] **6.16** **Grounding check**: all numbers/entities in output must exist in evidence, else fall back to template (`saas/explain/narrator.py`) (A)
- [x] **6.17** Dual flow: incident renders instantly with deterministic template; Gemini enriches when key provided (S+F)
- [x] **6.18** Vector schema for runbooks + embeddings at **768 dims** (`vector(768)`) (`supabase/migrations/001_initial_schema.sql`) (S)
- [x] **6.19** Runbook catalog recommendation mapping (`saas/reco/engine.py`) (A+S)
- [x] **6.20** Prompt-injection defence: only structured fields in prompts; sanitized context (A)
- [x] **6.21** Guardrails: circuit breaker to `TemplateClient`, timeout, fallback handling (`saas/explain/gemini_client.py`) (S)
- [x] **6.22** UI toggle "AI enrichment" on dashboard (`web/index.html`) (F)

**6E. Local (edge) AI: privacy innovation**
- [ ] **6.23** Local LLM via Ollama classifies raw log lines → category + count only (C+A)
- [ ] **6.24** Optional Presidio NER pass for PII in free text (C)
- [ ] **6.25** Local anomaly model on collector (tiny Isolation Forest / EWMA ensemble) (C+A)
- [ ] **6.26** Show in Raw-vs-Sent view: "raw text → local model → category sent" (F+C)

**Tests**
- [ ] **6.27** Compare Phase 5 vs Phase 6: false alarms, detection delay, explained signals; keep a table for slides (A+Q)
- [ ] **6.28** Kill LLM/ML services → system still alerts via Layers 0-1 (Q)

**Gate 6:** Side-by-side showing an anomaly that thresholds miss but ML catches; LLM explanation passes grounding check; AI-off fallback works.

---

## Phase 7: Global-Ready Design and Autonomous Ops Simulation (P1, size M)

**Global-ready**
- [ ] **7.1** Two or three regional Supabase projects (e.g. `ap-south`, `eu-central`, `us-east`) + control-plane `tenant → region → ingest URL` (S)
- [ ] **7.2** Collector enrollment returns regional ingest URL; ingest rejects wrong-region tenant (S+C)
- [ ] **7.3** Residency guard: no cross-region replication; test proving it (S+Q)
- [x] **7.4** UTC everywhere + `source_tz` schema fields (`collector/schemas.py`, `collector/normalize/normalizer.py`) (F)
- [ ] **7.5** DST edge-case tests (e.g. Europe/Berlin, Asia/Tokyo) (Q)
- [ ] **7.6** Demo: German tenant stays in EU project; Indian tenant in ap-south (all)

**Autonomous Ops (simulated)**
- [x] **7.7** Remediation catalogue: action, reversible?, blast radius, inverse action (`saas/reco/engine.py`) (A+S)
- [x] **7.8** **Policy engine**: risk level and policy checks (`saas/reco/engine.py`, `saas/remediation/executor.py`) (S)
- [x] **7.9** Approval workflow UI: approve/deny with reason (`web/index.html`) (F+S)
- [x] **7.10** Simulated executor for runbook execution (`saas/remediation/executor.py`) (S)
- [x] **7.11** **Hash-chained audit log** with verify-chain endpoint (`saas/remediation/executor.py`) (S)
- [x] **7.12** Rollback button + rollback record (`saas/remediation/executor.py`, `web/index.html`) (S+F)
- [x] **7.13** Autonomy levels: `recommend | approve_to_run` (`saas/remediation/executor.py`) (S)
- [x] **7.14** Audit and Governance section on dashboard (`web/index.html`) (F)

**Gate 7:** Incident → recommendation → policy check → approval → simulated action → audit entry → rollback, all visible. A German tenant's data is provably only in the EU store.

---

## Phase 8: Hardening, Testing, Demo and Presentation (P0, size M)

**Security hardening**
- [x] **8.1** Request size caps, context length limits, extra="forbid" schema caps (`collector/schemas.py`) (S)
- [x] **8.2** Rotate/revoke collector credentials in known collectors registry (`saas/ingest_api/main.py`) (S+C)
- [x] **8.3** Secrets in `.env`, no keys in repo; automated secret scan in CI (`tests/test_ci.py`) (all)
- [x] **8.4** Full canary leak test with 50+ secrets across varied formats (`tests/leak/test_leak.py`) (Q)
- [x] **8.5** RLS audit: all tenant tables protected by row level security (`supabase/policies/002_rls_policies.sql`) (S)

**Robustness**
- [x] **8.6** Error resilience: circuit breaker to TemplateClient, outbox retry with backoff (Q)
- [x] **8.7** Timestamps: UTC everywhere with separate received_at tracking (C+S)
- [x] **8.8** Outbox retention pruning and bounded memory usage (Q)

**Demo preparation**
- [x] **8.9** Demo walkthrough and 5-minute script (`DEPLOYMENT_AND_RUN_GUIDE.md`) (all)
- [x] **8.10** One-command demo targets: `make demo`, `make demo-reset` (`Makefile`) (Q)
- [ ] **8.11** Backup demo: recorded video walkthrough artifact (all)
- [x] **8.12** Judge question list and answers prepared (`DEPLOYMENT_AND_RUN_GUIDE.md`) (all)
- [x] **8.13** Known limitations and honest gaps documented (`docs/threat_model.md`, `architecture.md` §15) (all)
- [x] **8.14** Key metrics: p95 latency, 0 leaks, 85% incident confidence documented (Q+A)
- [x] **8.15** Innovations: canary leak proof, keyed pseudonyms, grounded narration documented (all)
- [x] **8.16** Final README and comprehensive runbook (`README.md`, `DEPLOYMENT_AND_RUN_GUIDE.md`) (all)
- [x] **8.17** Clean execution workflow tested and verified (Q)
- [ ] **8.18** Base image digest pinning for air-gapped production (Q)
- [x] **8.19** Trust boundary network isolation demonstrated in compose (`docker-compose.yml`) (all)

### Live scenario checklist (rehearse all)

| # | Scenario | Pass condition |
|---|----------|---------------|
| 1 | Raw log contains a secret | Not in SaaS; visible only on collector; egress log proves it |
| 2 | Collector loses SaaS connectivity | Detected, buffered, retried, resumed, 0 lost/0 dup |
| 3 | Repeated failed logins | Only a security summary leaves; no raw auth records |
| 4 | Network latency rises | Source, severity, trend, service impact shown |
| 5 | CPU/memory deviates from baseline | Flagged with contributing signals and recommendation |
| 6 | Several alerts relate to one incident | Merged into 1 incident with root cause |
| 7 | Duplicate / out-of-order delivery | Ordered by event time, de-duplicated by payload ID |
| 8 | Remediation proposed | Policy check → approval → audit → rollback/simulation |

### Judge Q&A drill (answer from memory)
- What exactly leaves the environment? Show the last payload.
- How are fields allowed? How do you stop secrets leaking?
- How are collectors authenticated and traffic encrypted?
- Real anomaly vs normal spike? How do you merge alerts?
- Why this recommendation? What data led to it?
- What if SaaS is down? How do you avoid loss and duplicates?
- How does it scale? How do regions/residency/UTC/out-of-order work?
- What safeguards before automated remediation?

**Gate 8:** Two clean full-run rehearsals with zero manual fixes.

---

## Working with Antigravity (development workflow)

- **Contracts first.** Commit `architecture.md`, `task.md`, the payload schema and `AGENTS.md` before generating code, so the agent builds against fixed contracts.
- **One phase, one task group at a time.** Give the agent a bounded task (e.g. "do 1.6-1.11 only") instead of "build the collector".
- **Tests alongside code.** Ask for the test with each feature (leak test, RLS test, outage test). A feature is not done until its test passes.
- **Review security-critical code by hand:** allow-list, redaction, RLS policies, ingest auth, and tenant derivation. Do not accept these unreviewed.
- **Keep secrets out of prompts and repo.** Only env var names are shared; values stay in `.env`.
- **Verify the agent's claims.** Run `make test` and the gate checks yourself after each phase.
- **Containers only.** Tell the agent never to run `pip install` on the host. To add a dependency: edit that service's `requirements.in`, run `make lock`, then `make build`.
- **Small commits per task ID** (e.g. `feat(1.9): keyed HMAC pseudonyms`) so you can roll back a bad generation.

---

## Parallel work split (4-person example)

| Person | Phases 0-4 focus | Phases 5-7 focus |
|--------|------------------|------------------|
| **1 Collector** | Phase 1 + outbox (4.1-4.5) | Local LLM/NER/edge model (6E) |
| **2 SaaS/DB** | Phase 2, health engine, late events | Regions, policy engine, audit, remediation |
| **3 AIOps** | Simulator (0.6-0.8), tests harness | Phases 5 and 6A-6D |
| **4 Frontend** | Dashboard, egress panel, collector UI | Incident cards, AI toggle, approval UI |

Everyone: leak test, outage test, demo rehearsals.

---

## Definition of Done (per feature)

- Works from the **shared/simulated stream**, not hard-coded data
- Runs **inside its container**; any new dependency is in that service's hash-locked requirements
- Has at least one automated test
- Its claim is **provable** in the UI or in a report (egress hash, ID sets, timestamps)
- Failure mode is handled and visible (stale, offline, AI-off)
- Documented in `README.md` or `architecture.md`
