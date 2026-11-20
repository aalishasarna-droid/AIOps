"""
Local raw store and transactional outbox — architecture.md §4, task.md §1.15, §4.1.

- Keeps raw telemetry strictly local inside Tier 1.
- TTL-based pruning ensures customer raw data is ephemeral.
- Transactional outbox guarantees reliable, at-least-once egress delivery.
"""

from __future__ import annotations

import json
import logging
import sqlite3
import time
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)


class LocalOutboxStore:
    """
    SQLite-backed local storage for:
    1. Raw local events (ephemeral, TTL-bounded).
    2. Pending egress payloads (outbox pattern).
    """

    def __init__(self, db_path: str | Path = "/app/data/collector.db"):
        self.db_path = Path(db_path)
        try:
            self.db_path.parent.mkdir(parents=True, exist_ok=True)
            self._init_db()
        except (sqlite3.OperationalError, PermissionError, OSError):
            fallback = Path("/tmp/collector.db")
            fallback.parent.mkdir(parents=True, exist_ok=True)
            self.db_path = fallback
            self._init_db()

    def _get_conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        with self._get_conn() as conn:
            # Table for local raw events (stays local, never transmitted)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS raw_events (
                    event_id TEXT PRIMARY KEY,
                    event_ts REAL NOT NULL,
                    kind TEXT NOT NULL,
                    raw_data TEXT NOT NULL,
                    expires_at REAL NOT NULL
                )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_raw_expires ON raw_events(expires_at)")

            # Table for outgoing allow-listed payloads (outbox)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS outbox_payloads (
                    payload_id TEXT PRIMARY KEY,
                    created_at REAL NOT NULL,
                    payload_json TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'pending', -- pending | sent | failed
                    retries INTEGER NOT NULL DEFAULT 0,
                    last_attempt REAL
                )
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox_payloads(status)")
            conn.commit()

    def save_raw_event(self, event_id: str, kind: str, raw_data: dict[str, Any], ttl_s: int = 86400) -> None:
        """Save raw event with TTL expiration."""
        now = time.time()
        expires_at = now + ttl_s
        with self._get_conn() as conn:
            conn.execute(
                "INSERT OR REPLACE INTO raw_events (event_id, event_ts, kind, raw_data, expires_at) VALUES (?, ?, ?, ?, ?)",
                (event_id, now, kind, json.dumps(raw_data), expires_at),
            )
            conn.commit()

    def queue_outbox(self, payload_id: str, payload_dict: dict[str, Any]) -> None:
        """Enqueue an allow-listed payload into the outbox for delivery."""
        now = time.time()
        with self._get_conn() as conn:
            conn.execute(
                "INSERT OR REPLACE INTO outbox_payloads (payload_id, created_at, payload_json, status) VALUES (?, ?, ?, 'pending')",
                (payload_id, now, json.dumps(payload_dict)),
            )
            conn.commit()

    def get_pending_payloads(self, limit: int = 50) -> list[dict[str, Any]]:
        """Fetch pending outbox payloads for delivery."""
        with self._get_conn() as conn:
            rows = conn.execute(
                "SELECT payload_id, payload_json, retries FROM outbox_payloads WHERE status = 'pending' ORDER BY created_at ASC LIMIT ?",
                (limit,),
            ).fetchall()
            return [
                {"payload_id": r["payload_id"], "payload": json.loads(r["payload_json"]), "retries": r["retries"]}
                for r in rows
            ]

    def mark_sent(self, payload_id: str) -> None:
        """Mark payload as successfully acknowledged by SaaS."""
        with self._get_conn() as conn:
            conn.execute(
                "UPDATE outbox_payloads SET status = 'sent', last_attempt = ? WHERE payload_id = ?",
                (time.time(), payload_id),
            )
            conn.commit()

    def mark_failed(self, payload_id: str) -> None:
        """Increment retries and mark failed for next attempt."""
        with self._get_conn() as conn:
            conn.execute(
                "UPDATE outbox_payloads SET retries = retries + 1, last_attempt = ? WHERE payload_id = ?",
                (time.time(), payload_id),
            )
            conn.commit()

    def purge_expired_raw(self) -> int:
        """Prune raw events older than their TTL."""
        now = time.time()
        with self._get_conn() as conn:
            cursor = conn.execute("DELETE FROM raw_events WHERE expires_at < ?", (now,))
            deleted = cursor.rowcount
            conn.commit()
            return deleted
