# Use Cases & Minimum Viable Demo Statement

> Ref: task.md §0.10, architecture.md §1

---

## Minimum Viable Demo (MVD) Statement

**"A secure, privacy-enforcing observability pipeline where raw telemetry—including injected canary credentials and sensitive customer logs—is filtered and summarized by a local collector with mathematical proof of zero leakage (side-by-side Raw vs. Sent egress audit with cryptographic SHA-256 hashes). The central SaaS tier receives only strictly schema-validated, allow-listed metadata across strict tenant boundaries, automatically groups multi-source signals into correlated incidents, and generates deterministic root-cause explanations with actionable remediation behind human approval."**

---

## 4 Core Use Cases

### 1. Zero-Leak Host & Application Observability
- **Persona:** SecOps & Compliance Officer.
- **Scenario:** Customer applications output high-cardinality metrics and noisy error logs containing API keys, database connection strings, bearer tokens, and PII.
- **Workflow:**
  1. The Local Collector monitors host resources (CPU, Memory, Disk, Network) and ingests syslog lines.
  2. Multi-tier redaction strips known secret keys, scrubs patterns (JWT, AWS keys, credit cards, emails, IPs), and HMAC-pseudonymizes hostnames.
  3. Windowed aggregation collapses 1s/5s metrics into statistical summaries (`avg`, `max`, `p95`).
  4. The serialized payload is hashed (SHA-256) and logged locally into an append-only egress log *before* transmission.
  5. The customer verifies through the Local Collector Admin UI that raw secrets never cross the WAN boundary.

### 2. Cascading Failure Detection & Automated Incident Merging
- **Persona:** Site Reliability Engineer (SRE).
- **Scenario:** A backend database outage causes connection pool exhaustion, elevated query latency, HTTP 500 error spikes in API gateways, and upstream service queue backpressure.
- **Workflow:**
  1. The SaaS Ingest API validates and stores time-windowed metadata from distributed collectors across tenant isolation barriers.
  2. The AIOps correlation engine detects concurrent metric anomalies across dependent services using EWMA deviation and topology dependency graph traversal.
  3. Instead of bombarding on-call engineers with 20 distinct alerts, the engine coalesces related anomalies into a **single incident** with a clear timeline and causal dependency chain.

### 3. Explainable Root-Cause Analysis with Human-in-the-Loop Remediation
- **Persona:** DevOps Engineer on Incident Response.
- **Scenario:** Critical latency spike in payment processing service.
- **Workflow:**
  1. The Incident Engine gathers structured evidence (contributing signals, deviation scores, topological proximity).
  2. The Explainability module (`LLMClient`) produces a grounded root-cause explanation highlighting why the incident was flagged and ranking candidate root causes.
  3. The platform proposes targeted remediation runbooks (e.g., restart read-replica, scale container replicas, flush cache).
  4. Autonomous execution is gated behind explicit human approval with rollback safety.

### 4. Adversarial Attack & Failed-Login Burst Detection
- **Persona:** Security Operations Analyst.
- **Scenario:** A brute-force SSH/API authentication burst hits customer edge services.
- **Workflow:**
  1. The Local Collector identifies high-frequency auth failures in local logs using a sliding window.
  2. Rather than streaming raw authentication attempts (which contain target usernames and password guesses), the collector generates a single aggregated `security_summary` payload (`{event: auth_anomaly, count: 142, window_s: 10, severity: critical}`).
  3. SaaS immediately raises a security incident without ever exposing sensitive credential data to the cloud.
