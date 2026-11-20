"""
Payload JSON Schema — the allow-listed contract between Collector (Tier 1) and SaaS (Tier 2).

This module defines EXACTLY what may leave the customer environment.
Pydantic v2 with extra="forbid" enforces default-deny: any unknown field is rejected.

Ref: architecture.md §5
"""

from __future__ import annotations

import enum
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, ConfigDict, field_validator


# ---------------------------------------------------------------------------
# Enums (closed sets — unknown values are rejected)
# ---------------------------------------------------------------------------

class PayloadKind(str, enum.Enum):
    metric_window = "metric_window"
    health = "health"
    alert = "alert"
    security_summary = "security_summary"
    heartbeat = "heartbeat"


class Severity(str, enum.Enum):
    info = "info"
    warning = "warning"
    critical = "critical"


# ---------------------------------------------------------------------------
# Nested models
# ---------------------------------------------------------------------------

class MetricValue(BaseModel):
    """A single metric's aggregated values within a window."""
    model_config = ConfigDict(extra="forbid")

    avg: Optional[float] = None
    min: Optional[float] = None
    max: Optional[float] = None
    p50: Optional[float] = None
    p95: Optional[float] = None
    p99: Optional[float] = None
    count: Optional[int] = None


class CollectorMeta(BaseModel):
    """Lightweight self-report from the collector (resource use, version)."""
    model_config = ConfigDict(extra="forbid")

    version: str = Field(..., max_length=32)
    cpu_pct: Optional[float] = None
    mem_mb: Optional[float] = None
    config_hash: Optional[str] = Field(None, max_length=12)


# ---------------------------------------------------------------------------
# Top-level payload (the ONLY shape that may cross the trust boundary)
# ---------------------------------------------------------------------------

class IngestPayload(BaseModel):
    """
    Allow-listed payload contract.

    - extra="forbid" ➜ unknown fields are rejected (default-deny).
    - tenant_id is intentionally absent; the server derives it from the credential.
    - context is length-capped and re-scanned server-side.
    """
    model_config = ConfigDict(extra="forbid")

    payload_id: str = Field(
        ...,
        description="UUIDv7 assigned at creation time, not at send time",
        min_length=36,
        max_length=36,
    )
    schema_version: str = Field(
        "1.0",
        description="Contract version; bump on breaking changes",
        max_length=8,
    )
    collector_id: str = Field(..., max_length=64)
    region: Optional[str] = Field(None, max_length=32)
    event_ts_utc: datetime
    source_tz: Optional[str] = Field(None, max_length=64)
    source_id: str = Field(
        ...,
        description="HMAC-pseudonymized source identifier",
        max_length=64,
    )
    kind: PayloadKind
    window_s: Optional[int] = Field(None, ge=1, le=3600)

    # Metric values keyed by metric name
    metrics: Optional[dict[str, MetricValue]] = None

    # Classification / alert fields
    category: Optional[str] = Field(None, max_length=64)
    severity: Optional[Severity] = None
    deviation: Optional[dict[str, float]] = None
    context: Optional[str] = Field(
        None,
        max_length=200,
        description="Free text, length-capped, re-scanned server-side",
    )

    collector_meta: Optional[CollectorMeta] = None

    # --- Validators -----------------------------------------------------------

    @field_validator("context")
    @classmethod
    def scrub_context(cls, v: Optional[str]) -> Optional[str]:
        """Final safety net: reject context that looks like it contains secrets."""
        if v is None:
            return v
        # Simple deny patterns (expanded in redact module)
        import re
        deny_patterns = [
            r"(?i)(password|passwd|secret|token|api_key)\s*[:=]",
            r"eyJ[A-Za-z0-9_-]{10,}",  # JWT
            r"AKIA[0-9A-Z]{16}",        # AWS access key
        ]
        for pat in deny_patterns:
            if re.search(pat, v):
                return "[REDACTED]"
        return v


# ---------------------------------------------------------------------------
# Batch wrapper
# ---------------------------------------------------------------------------

class IngestBatch(BaseModel):
    """Batch of payloads for a single POST /ingest call."""
    model_config = ConfigDict(extra="forbid")

    payloads: list[IngestPayload] = Field(..., min_length=1, max_length=500)
