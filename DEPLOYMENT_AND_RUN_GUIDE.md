# Deployment & Run Guide: Secure Two-Tier AIOps Observability Platform

> **CICADA 2026 Hackathon**  
> Complete reference for architecture, environment variables, API keys, execution commands, and judge demo walkthrough.

---

## 1. System Overview

The platform implements a **Secure Two-Tier Observability Architecture**:

```
┌──────────────────────────────────────────────┐          TRUST BOUNDARY          ┌──────────────────────────────────────────────┐
│  TIER 1: CUSTOMER LOCAL ENVIRONMENT          │                 ║                │  TIER 2: CENTRAL SAAS PLATFORM               │
│                                              │                 ║                │                                              │
│  ┌────────────┐      ┌────────────────────┐  │                 ║                │  ┌────────────────────┐  ┌────────────────┐  │
│  │ Simulator  │ ───▶ │  Local Collector   │  │                 ║                │  │  FastAPI Ingest    │  │ Fleet Health   │  │
│  │ (Canaries) │      │                    │  │                 ║                │  │  (AuthN & Schemas) │  │ (4-State Engine│  │
│  └────────────┘      │  • Multi-redaction │  │                 ║                │  └─────────┬──────────┘  └───────┬────────┘  │
│                      │  • HMAC Pseudonyms │  │                 ║                │            │                     │           │
│  ┌────────────┐      │  • 1s/5s Windowing │  │                 ║                │            ▼                     ▼           │
│  │ Host/Logs  │ ───▶ │  • Outbox / TTL    │  │  POST /ingest   ║                │  ┌─────────────────────────────────────────┐  │
│  └────────────┘      │  • Egress SHA-256  │ ─╫─────────────────╫───────────────▶│  AIOps Correlation & Incident Merging   │  │
│                      └─────────┬──────────┘  │  (Allow-list)   ║                │  • Topology graph traversal                │  │
│                                │             │                 ║                │  • Root cause candidate ranking            │  │
│                                ▼             │                 ║                └────────────────────┬────────────────────┘  │
│                      ┌────────────────────┐  │                 ║                                     │                       │
│                      │ Local Admin UI     │  │                 ║                                     ▼                       │
│                      │ (Port 8080)        │  │                 ║                ┌─────────────────────────────────────────┐  │
│                      │ Raw vs Sent Audit  │  │                 ║                │ Grounded Narration & Explainability     │  │
│                      └────────────────────┘  │                 ║                │ • Gemini 2.5 LLM / Deterministic Fallback│ │
│                                              │                 ║                └────────────────────┬────────────────────┘  │
│                                              │                 ║                                     │                       │
│                                              │                 ║                                     ▼                       │
│                                              │                 ║                ┌─────────────────────────────────────────┐  │
│                                              │                 ║                │ Human-in-the-Loop Remediation Gate      │  │
│                                              │                 ║                │ • Approve / Rollback with Hash Chain    │  │
│                                              │                 ║                └─────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘                 ║                └──────────────────────────────────────────────┘
```

- **Tier 1 (Customer Private Environment):** Ingests raw telemetry and customer logs with planted canary secrets (`CANARY-...`). Applies key-based redaction, pattern regexes (JWT, AWS keys, credit cards, emails, IPs), HMAC pseudonymization for hostnames, and tumbling window aggregation. Writes a canonical SHA-256 digest to the **Egress Log** *before* send.
- **Tier 2 (Central SaaS):** Ingestion API validates payload using strict default-deny (`extra="forbid"`), authenticates collector via `X-Collector-Key`, derives tenant ID on the server (cannot be spoofed), correlates alerts via dependency topology into a single incident, generates grounded root-cause explanations via Google Gemini, and presents remediation proposals behind an explicit human approval gate.

---

## 2. API Keys & Environment Variables

All settings are configured in `.env` (gitignored). Copy from `.env.example`:

```bash
cp .env.example .env
```

### Complete Configuration Reference

| Variable | Description | Required? | Default / Example | Notes |
|:---|:---|:---:|:---|:---|
| `GEMINI_API_KEY` | Google Gemini API Key | Optional | `AIzaSy...` | Get free key at [Google AI Studio](https://aistudio.google.com/). If omitted, the platform uses the built-in deterministic `TemplateClient`. |
| `LLM_MODEL` | Gemini Model ID | Optional | `gemini-2.5-flash` | Fast, high-accuracy model for incident narration. |
| `EMBEDDING_MODEL` | Embedding Model ID | Optional | `text-embedding-004` | Used for runbook vector search. |
| `EMBEDDING_DIM` | Embedding Dimensions | Optional | `768` | Matches Gemini text-embedding-004. |
| `LLM_TIMEOUT_S` | LLM Call Timeout (sec) | Optional | `8` | Circuit breaker triggers template fallback if exceeded. |
| `COLLECTOR_ID` | Collector Identifier | **Yes** | `col-local-01` | Unique collector node ID. |
| `COLLECTOR_API_KEY` | Collector Ingest Token | **Yes** | `test-collector-key-abc123` | Sent in `X-Collector-Key` header; server derives `tenant_id` from this. |
| `TENANT_SECRET` | Local HMAC Secret Salt | **Yes** | `local-tenant-secret-key-32bytes!` | **Stays local**. Used for HMAC-SHA256 source pseudonymization. |
| `INGEST_URL` | SaaS Ingest API URL | **Yes** | `http://localhost:8000` | In Docker: `http://ingest-api:8000`. |
| `SIMULATOR_SCENARIO` | Telemetry Scenario | Optional | `normal` | Options: `normal`, `db_outage_cascade`, `memory_leak`, `login_burst`, `net_latency`. |
| `SIMULATOR_INTERVAL_S` | Simulator Tick Interval | Optional | `5` | Emission frequency in seconds. |
| `ADMIN_UI_PORT` | Local Collector UI Port | Optional | `8080` | Localhost only privacy verification panel. |
| `SUPABASE_URL` | Supabase Project URL | Optional | `https://xyz.supabase.co` | Cloud or local Supabase instance. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Server Key | Optional | `ey...` | Server-side only; never expose to web client. |
| `POSTGRES_PASSWORD` | Local Postgres Password | Optional | `postgres` | For local database containers. |

---

## 3. How to Run the Application

You can run the application either directly with Python (fastest for development/testing) or inside isolated Docker containers.

### Method A: Run Directly with Python (Recommended & Fastest on Mac)

> [!TIP]
> **On macOS:** By default, macOS uses `python3` instead of `python`, and modern Python requires a virtual environment (`.venv`) so packages like `uvicorn` and `fastapi` are available. Run this once first:
> ```bash
> # 1. Create a virtual environment in the project directory
> python3 -m venv .venv
>
> # 2. Activate the virtual environment (sets up 'python' on your PATH)
> source .venv/bin/activate
>
> # 3. Install required packages
> pip install -r saas/requirements.txt -r collector/requirements.txt
> ```
> *Note: In each new terminal tab you open on macOS, simply run `source .venv/bin/activate`!*

#### Terminal 1 — Start the SaaS Ingest API & Web Dashboard
```bash
# Ensure venv is activated: source .venv/bin/activate
python -m uvicorn saas.ingest_api.main:app --host 0.0.0.0 --port 8000 --reload
```
- **Web Dashboard:** Open [http://localhost:8000/dashboard](http://localhost:8000/dashboard) or [http://localhost:8000](http://localhost:8000)
- **API Health:** Open [http://localhost:8000/health](http://localhost:8000/health)

#### Terminal 2 — Start the Tier 1 Local Collector & Privacy Gate
```bash
# Ensure venv is activated: source .venv/bin/activate
python -m collector.main
```
- **Local Collector Admin UI:** Open [http://localhost:8080](http://localhost:8080)
- Watch live side-by-side Raw vs. Sent egress logs with SHA-256 provenance hashes!

#### Terminal 3 — Run Telemetry Scenarios / Simulator
```bash
# Ensure venv is activated: source .venv/bin/activate

# 1. Normal baseline stream
python -m simulator.runner --scenario normal --interval 2.0

# 2. Database outage cascade (demo scenario)
python -m simulator.runner --scenario db_outage_cascade --interval 2.0

# 3. Failed login brute force burst
python -m simulator.runner --scenario login_burst --interval 2.0

# 4. Memory leak
python -m simulator.runner --scenario memory_leak --interval 2.0
```

---

### Method B: Run via Docker Compose

With Docker, you do not need Python or virtual environments installed on your Mac. All services run inside isolated containers.

#### Terminal 1 — Start Core Services (Collector, Ingest API, Simulator)
```bash
# Build and start services in the background
docker compose up --build -d

# Check running services
docker compose ps
```
- **Web Dashboard:** Open [http://localhost:8000/dashboard](http://localhost:8000/dashboard)
- **Local Collector Admin UI:** Open [http://localhost:8080](http://localhost:8080)

#### Terminal 2 — Tail Service Logs
```bash
# View combined logs
docker compose logs -f

# Or tail individual services:
docker compose logs -f ingest-api
docker compose logs -f collector
docker compose logs -f simulator
```

#### Terminal 3 — Run Telemetry Scenarios / Simulator in Docker
Run simulator scenarios directly inside the running Docker container:

```bash
# 1. Normal baseline stream
docker compose exec simulator python -m simulator.runner --scenario normal --interval 2.0

# 2. Database outage cascade (primary hackathon demo scenario)
docker compose exec simulator python -m simulator.runner --scenario db_outage_cascade --interval 2.0

# 3. Failed login brute force burst
docker compose exec simulator python -m simulator.runner --scenario login_burst --interval 2.0

# 4. Memory leak
docker compose exec simulator python -m simulator.runner --scenario memory_leak --interval 2.0

# Alternatively, run as a one-off standalone container:
docker compose run --rm simulator python -m simulator.runner --scenario db_outage_cascade --interval 2.0
```

#### Useful Docker Management Commands
```bash
# Stop all services
docker compose down

# Clean reset (stops containers, removes volumes, and resets state)
docker compose down -v
```

---

## 4. How to Run Tests

All unit tests, security leak tests, and tenant isolation tests are fully automated:

```bash
# Run all tests
python -m pytest tests/ -v

# Run Canary Secret Leak Test (injects 50+ canary secrets; asserts 0 reach SaaS)
python -m pytest tests/leak/ -v

# Run Tenant Isolation & Auth tests
python -m pytest tests/tenant_isolation/ -v

# Run Architecture Boundary & CI tests
python -m pytest tests/test_ci.py -v
```

---

## 5. Judge Demo Walkthrough (5-Minute Script)

Follow these steps to demonstrate every judging criterion:

### Phase 1: Prove Zero-Leakage (Collector Privacy Gate)
1. Navigate to **http://localhost:8080** in your browser.
2. In the "Interactive Zero-Leak Verification" box, paste raw logs with credentials:
   ```text
   DEBUG auth_service: user=admin password=CANARY-password-hunter2 token=eyJhbGciOiJIUzI1NiJ9.fake credit_card=4111111111111111 host=db-primary-internal
   ```
3. Click **"Simulate Ingest & Redact"**.
4. **Show the judges:**
   - The password, token, and credit card are **100% scrubbed**.
   - Hostname `db-primary-internal` is pseudonymized to `src_8f9a2b1c...` using keyed HMAC.
   - The **Egress Audit Trail** shows the canonical SHA-256 hash generated *before* sending.

### Phase 2: Show Fleet Health & Default-Deny Ingestion
1. Navigate to the SaaS Dashboard: **http://localhost:8000/dashboard**.
2. Show the **4-State Fleet Health Engine** (Healthy / Degraded / Critical / Stale).
3. Highlight the live counter: **`0 Leaks · 100% Verified`**.

### Phase 3: Trigger Cascading Failure & Incident Merging
1. In the Web Dashboard header, click the **"DB Outage Cascade"** button (or run `python -m simulator.runner --scenario db_outage_cascade`).
2. **Observe:**
   - Rather than 20 disconnected alerts, the correlator detects topology links between `db-primary`, `auth-service`, and `api-gateway`.
   - Coalesces into a single **Merged Incident**: *"Cascading Degradation rooted in db-primary"* with **85% confidence**.

### Phase 4: Grounded AI Explainability & Human-in-the-Loop Remediation
1. Inspect the **Grounded Explainability** card:
   - Root cause candidate clearly flagged with contributing signal deviations.
   - Grounding check verified (`✓ Passed (Zero Hallucination)`).
2. Look at the **Action Gate**:
   - Proposed runbook: `EXEC_SQL: SELECT pg_terminate_backend(pid) FROM pg_stat_activity;`.
   - The system **will not execute autonomously**; it waits for human approval.
3. Click **"✓ Approve & Execute"**:
   - The action executes cleanly.
   - An entry is appended to the **tamper-evident SHA-256 hash-chained audit log**.
4. Click **"↺ Rollback"**:
   - Demonstrates safe rollback orchestration.

---

## 6. Directory Structure Reference

```
AIOps/
├── collector/                      # Tier 1 Customer-Side Collector
│   ├── schemas.py                  # Single source of truth: Pydantic extra="forbid"
│   ├── main.py                     # Collector daemon & event loop
│   ├── sources/                    # host (psutil), probe (latency), syslog, replay
│   ├── normalize/                  # Normalizes raw telemetry into RawEvent
│   ├── redact/                     # Scrubbers (regex, Luhn, keys), HMAC pseudonymizer
│   ├── policy/                     # Tenant YAML policy engine
│   ├── aggregate/                  # Tumbling window aggregation (1s/5s)
│   ├── analyze/                    # Failed-login detector & EWMA deviation
│   ├── outbox/                     # SQLite raw store with TTL & transactional outbox
│   ├── egress/                     # Pre-send SHA-256 canonical logger
│   ├── transport/                  # WAN HTTP client with backoff
│   └── admin_ui/                   # Localhost privacy verification UI (Port 8080)
├── saas/                           # Tier 2 Multi-Tenant Central Platform
│   ├── ingest_api/                 # FastAPI /ingest, /health, /dashboard
│   ├── detectors/                  # 4-state fleet health engine
│   ├── aiops/                      # Topology dependency graph & incident correlator
│   ├── explain/                    # LLMClient, TemplateClient, GeminiClient, Narrator
│   ├── reco/                       # Runbook recommendation engine
│   └── remediation/                # Human approval gate & hash-chained audit log
├── simulator/                      # Synthetic telemetry generator & scenario runner
│   ├── generator.py                # Telemetry streams with planted canaries
│   └── runner.py                   # Interactive scenario CLI
├── web/                            # Interactive SaaS Dashboard (HTML/CSS/JS)
│   └── index.html                  # Modern glassmorphism dark-mode UI
├── supabase/                       # Database migrations, RLS policies, and seed data
│   ├── migrations/001_initial_schema.sql
│   ├── policies/002_rls_policies.sql
│   └── seed/seed.sql
├── tests/                          # Automated test suites
│   ├── test_ci.py                  # CI boundaries (no LLM in collector, volume check)
│   ├── leak/                       # 50+ canary leak test & scrubber unit tests
│   └── tenant_isolation/           # API key auth & tenant derivation tests
├── docs/                           # Architecture specifications & threat model
├── Makefile                        # Docker & test automation targets
├── docker-compose.yml              # Isolated networks (customer_net, wan_net, saas_net)
├── AGENTS.md                       # Architectural rules and boundaries
└── DEPLOYMENT_AND_RUN_GUIDE.md     # This comprehensive guide
```
