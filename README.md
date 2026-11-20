# Secure Two-Tier AIOps Observability Platform

[![Architecture Contract](https://img.shields.io/badge/Contract-Default--Deny-emerald.svg)](docs/architecture%20(8).md)
[![Trust Boundary](https://img.shields.io/badge/Trust_Boundary-Customer_vs_SaaS-blue.svg)](docs/trust_boundary.md)
[![Zero Leak](https://img.shields.io/badge/Zero_Leak_Test-Passed-brightgreen.svg)](tests/leak/)
[![AIOps](https://img.shields.io/badge/AIOps-Explainable_Incident_Merging-purple.svg)](saas/aiops/)

A privacy-enforcing observability platform engineered for high-security environments. A **Local Collector** runs inside the customer perimeter, scrubs raw telemetry, redacts secrets, summarizes locally, and ships **only allow-listed metadata** over an authenticated WAN link to a **central SaaS platform**. The SaaS tier detects cascading anomalies, merges alerts into single correlated incidents, explains likely root causes with grounded AI, and proposes remediation actions behind a strict human approval gate.

---

## ⚡ Quick Start

For full setup details, environment variables, API keys, and demo walkthroughs, see:  
📖 **[DEPLOYMENT_AND_RUN_GUIDE.md](DEPLOYMENT_AND_RUN_GUIDE.md)**

### Run in 3 Commands

1. **Start the SaaS Ingest API & Dashboard (Port 8000):**
   ```bash
   python -m uvicorn saas.ingest_api.main:app --port 8000
   ```
   Open **[http://localhost:8000/dashboard](http://localhost:8000/dashboard)**

2. **Start the Local Collector & Privacy Audit Gate (Port 8080):**
   ```bash
   python -m collector.main
   ```
   Open **[http://localhost:8080](http://localhost:8080)**

3. **Trigger Failure Scenarios with the Simulator:**
   ```bash
   python -m simulator.runner --scenario db_outage_cascade
   ```

---

## 🔑 Key Features

1. **Default-Deny Schema Contract:** Pydantic v2 with `extra="forbid"` ensures unknown fields are rejected before leaving the customer environment.
2. **Cryptographic Egress Audit Log:** Canonical JSON is hashed with SHA-256 and committed locally *before* WAN transmission.
3. **Cascading Incident Merging:** Graph-based correlation collapses 20+ cascading alerts into a single incident with topology root cause tracing.
4. **Grounded AI Narration:** Google Gemini API provides human-readable explanations with anti-hallucination grounding checks.
5. **Human-in-the-Loop Remediation:** Runbook execution is gated behind operator approval with automated rollback and an append-only hash chain.
