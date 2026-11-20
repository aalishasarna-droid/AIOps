# Trust Boundary Diagram

> Ref: architecture.md §2, §12.1

```
                                    TRUST BOUNDARY
                                         ║
  ┌──────────────────────────────────────╫──────────────────────────────────────────┐
  │  TIER 1: CUSTOMER ENVIRONMENT        ║   TIER 2: CENTRAL SAAS                  │
  │  (customer_net — Docker internal)    ║   (saas_net)                             │
  │                                      ║                                          │
  │  ┌────────────┐                      ║                                          │
  │  │ Simulator  │──events──┐           ║                                          │
  │  └────────────┘          │           ║                                          │
  │                          ▼           ║                                          │
  │  ┌────────────┐  ┌──────────────┐    ║   ┌──────────────┐                       │
  │  │  Ollama    │──│  Collector   │────╫──▶│  Ingest API  │                       │
  │  │ (edge-ai)  │  │              │    ║   │  (FastAPI)   │                       │
  │  └────────────┘  │  Sources     │    ║   │              │                       │
  │                  │  Normalize   │    ║   │  AuthN       │                       │
  │  ┌────────────┐  │  Redact      │    ║   │  Schema re-  │                       │
  │  │ Host/Apps  │──│  Analyze     │    ║   │  validate    │                       │
  │  │ (psutil,   │  │  Aggregate   │    ║   │  Dedupe      │                       │
  │  │  syslog)   │  │  Policy      │    ║   │  Store       │                       │
  │  └────────────┘  │  Egress log  │    ║   └──────┬───────┘                       │
  │                  │  Outbox      │    ║          │                                │
  │                  └──────┬───────┘    ║          ▼                                │
  │                         │            ║   ┌──────────────┐    ┌──────────────┐    │
  │                  ┌──────▼───────┐    ║   │  Supabase    │───▶│  Web App     │    │
  │                  │ Local Store  │    ║   │  (Postgres)  │    │  (Next.js)   │    │
  │                  │ (SQLCipher)  │    ║   │  RLS on      │    │              │    │
  │                  │              │    ║   │  tenant_id   │    │  Dashboards  │    │
  │                  │ • Raw logs   │    ║   │  Realtime    │    │  Incidents   │    │
  │                  │   (TTL)      │    ║   │  pgvector    │    │  Egress      │    │
  │                  │ • Outbox     │    ║   └──────┬───────┘    │  Proof Panel │    │
  │                  │ • Egress log │    ║          │            └──────────────┘    │
  │                  └──────────────┘    ║          ▼                                │
  │                                      ║   ┌──────────────┐                       │
  │                                      ║   │  Detectors   │                       │
  │                                      ║   │  AIOps       │                       │
  │                                      ║   │  Explain     │───▶ Gemini API        │
  │                                      ║   │  Reco (RAG)  │    (metadata only)    │
  │                                      ║   │  Remediation │                       │
  │                                      ║   └──────────────┘                       │
  └──────────────────────────────────────╫──────────────────────────────────────────┘
                                         ║

  WHAT CROSSES THE BOUNDARY:
  ─────────────────────────
  ✅ Allow-listed JSON payloads (C1 derived metadata only)
  ✅ HMAC-pseudonymized source IDs
  ✅ Aggregated metric values (avg, max, p95)
  ✅ Category labels and counts
  ✅ Severity, deviation scores, short context (≤200 chars)
  ✅ Heartbeat with collector meta

  ❌ NEVER crosses:
  ❌ Raw log lines
  ❌ Passwords, tokens, API keys, JWTs (C3)
  ❌ Email addresses, real IPs, hostnames (C2)
  ❌ Auth records (only summary counts)
  ❌ Any field not in the allow-list schema

  TRANSPORT:
  ──────────
  • HTTPS (TLS 1.3) + collector identity (mTLS or signed JWT)
  • Each payload has UUIDv7 ID
  • Egress log written BEFORE send (proof of what left)
  • Server-side receipt with SHA-256 match
```

## Docker network mapping

| Docker Network | Trust Zone | Internet? | Services |
|---------------|-----------|----------|----------|
| `customer_net` | Tier 1 (internal: true) | **No** | simulator, collector, ollama |
| `wan_net` | Link between tiers | No | collector, toxiproxy, ingest-api |
| `saas_net` | Tier 2 | Via explain only | ingest-api, detectors, aiops, web, Supabase |

**Verification:** `docker compose config` and `docker network inspect customer_net` show that `internal: true` blocks internet access. Only the collector bridges `customer_net` and `wan_net`. SaaS containers cannot mount the `collector_raw` volume.
