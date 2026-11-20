# Data Classification Table

> Ref: architecture.md §3. This table defines EXACTLY what data stays local,
> what is dropped, and what is sent to the SaaS tier.

## Classification levels

| Class | Label | Examples | Where it lives | Leaves customer env? |
|-------|-------|----------|----------------|---------------------|
| **C3** | Secret | Passwords, tokens, API keys, private keys, session IDs, JWTs | Collector memory only (never persisted unredacted) | **NEVER** |
| **C2** | Sensitive raw | Raw log lines, request payloads, emails, usernames, IP addresses, hostnames, URLs, auth records | Collector local store (encrypted, TTL-bound) | **No** — only pseudonymized IDs or counts |
| **C1** | Derived metadata | Metric values, window aggregates, health state, event category, severity, short alert context, counts, deviation scores | Collector → SaaS | **Yes** — allow-listed only |
| **C0** | Platform data | Tenant config, thresholds, incident records, audit log, user accounts | SaaS only | n/a |

## Per-field classification

| Field | Class | Action | What is sent |
|-------|-------|--------|-------------|
| `password`, `token`, `api_key`, `authorization`, `cookie`, `secret` | C3 | **Dropped** (key-based redaction) | Nothing |
| JWT patterns (`eyJ...`) | C3 | **Scrubbed** (regex) | Nothing |
| AWS keys (`AKIA...`) | C3 | **Scrubbed** (regex) | Nothing |
| Credit card numbers | C3 | **Scrubbed** (Luhn + regex) | Nothing |
| Email addresses | C2 | **Dropped** (regex) | Nothing |
| IP addresses | C2 | **Dropped** (regex) | Nothing |
| Hostnames | C2 | **Pseudonymized** | `HMAC-SHA256(tenant_secret, hostname)` truncated |
| Raw log lines | C2 | **Classified locally** (optional local LLM) | Category + count only (e.g. `db_error: 3`) |
| Auth records | C2 | **Summarized** | `{event: auth_anomaly, count, window_s, severity}` |
| CPU %, memory %, disk %, network bandwidth | C1 | **Aggregated** (1s/5s windows) | `{avg, max, p95}` per metric |
| Latency, packet loss | C1 | **Aggregated** | `{avg, p95}` per target |
| Health state | C1 | **Computed** | `Excellent/Good/Fair/Poor` + reason string |
| Deviation score | C1 | **Computed** (EWMA) | Numeric sigma value |
| Alert context | C1 | **Length-capped** (200 chars) + re-scanned | Short description string |

## Rules

1. A field leaves the customer environment ONLY if:
   - It is in the allow-list schema (`collector/schemas.py`, `extra="forbid"`)
   - Its value passes all output validators (no regex hit for secret/PII patterns, length caps, enum checks)
2. If a validator fails, the **field** is dropped and the event is flagged `redaction_failure` (the flag goes to SaaS, the content does not).
3. Pseudonymization uses `HMAC-SHA256(tenant_secret, raw_value)` — the key stays local, never crosses the boundary.
