"""
Internal Event normalizer for Tier 1 Collector.
Ref: architecture.md §4, task.md §1.5
"""

from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any, Optional
from pydantic import BaseModel, Field


class RawEvent(BaseModel):
    """
    Standardized internal event representation before redaction and filtering.
    Stays inside Tier 1 — never leaves the customer environment.
    """
    event_id: str
    event_ts_utc: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    source_tz: str = "UTC"
    raw_source_id: str
    kind: str  # host_metrics | syslog | probe | replay | auth
    data: dict[str, Any] = Field(default_factory=dict)
    raw_text: Optional[str] = None


def normalize_event(
    kind: str,
    raw_source_id: str,
    data: Optional[dict[str, Any]] = None,
    raw_text: Optional[str] = None,
    source_tz: str = "UTC",
    event_ts: Optional[datetime] = None,
) -> RawEvent:
    """Normalize any telemetry input into a standard RawEvent."""
    import uuid
    return RawEvent(
        event_id=str(uuid.uuid4()),
        event_ts_utc=event_ts or datetime.now(timezone.utc),
        source_tz=source_tz,
        raw_source_id=raw_source_id,
        kind=kind,
        data=data or {},
        raw_text=raw_text,
    )
