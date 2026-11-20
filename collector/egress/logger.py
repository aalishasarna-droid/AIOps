"""
Egress log — architecture.md §4, task.md §1.16.

Principle P2: "Prove it, don't claim it"
- Serializes the exact outgoing payload to canonical JSON.
- Computes SHA-256 hash.
- Logs to append-only local audit trail BEFORE sending over the network.
- SaaS receipt matches the payload by payload_id and payload_hash.
"""

from __future__ import annotations

import hashlib
import json
import logging
from pathlib import Path
from typing import Any, Tuple

logger = logging.getLogger(__name__)


class EgressLogger:
    """Maintains an append-only verifiable egress log on the collector node."""

    def __init__(self, log_path: str | Path = "/app/data/egress.log"):
        self.log_path = Path(log_path)
        self.log_path.parent.mkdir(parents=True, exist_ok=True)

    def log_egress(self, payload_dict: dict[str, Any]) -> Tuple[str, str]:
        """
        Record outgoing payload before network transmission.
        Returns (serialized_canonical_json, sha256_hash).
        """
        canonical_json = json.dumps(payload_dict, sort_keys=True, separators=(",", ":"))
        payload_hash = hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()

        log_entry = {
            "payload_id": payload_dict.get("payload_id"),
            "hash": payload_hash,
            "ts": payload_dict.get("event_ts_utc"),
            "kind": payload_dict.get("kind"),
            "payload": payload_dict,
        }

        try:
            with open(self.log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps(log_entry) + "\n")
        except Exception as e:
            logger.error("Failed to write to egress log: %s", e)

        return canonical_json, payload_hash

    def get_recent_entries(self, limit: int = 50) -> list[dict[str, Any]]:
        """Read recent egress entries for local verification or audit."""
        if not self.log_path.exists():
            return []
        entries = []
        try:
            with open(self.log_path, "r", encoding="utf-8") as f:
                lines = f.readlines()
                for line in lines[-limit:]:
                    line = line.strip()
                    if line:
                        entries.append(json.loads(line))
        except Exception as e:
            logger.error("Failed reading egress log: %s", e)
        return entries
