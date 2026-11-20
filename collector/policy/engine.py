"""
Policy Engine — task 1.11.
Loads and enforces per-tenant policy (metrics allow-list, sampling rates, retention, redaction overrides).
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Optional
import yaml

logger = logging.getLogger(__name__)

DEFAULT_POLICY = {
    "version": "1.0",
    "allow_listed_metrics": [
        "cpu_pct",
        "mem_pct",
        "mem_used_mb",
        "mem_total_mb",
        "mem_available_mb",
        "disk_pct",
        "disk_used_gb",
        "disk_total_gb",
        "cpu_cores",
        "load_1m",
        "net_rx_kbps",
        "net_tx_kbps",
        "net_bw_mbps",
        "latency_ms",
        "packet_loss_pct",
        "query_latency_ms",
        "pool_usage_pct",
    ],
    "sampling_interval_s": 5,
    "tumbling_window_s": 5,
    "retention_hours": 24,
    "redaction": {
        "drop_ips": True,
        "drop_emails": True,
        "scrub_urls": True,
    },
}


class PolicyEngine:
    """Manages tenant-specific collection, aggregation, and redaction rules."""

    def __init__(self, policy_path: Optional[str | Path] = None):
        self.policy: dict[str, Any] = dict(DEFAULT_POLICY)
        if policy_path and Path(policy_path).exists():
            self.load_policy(policy_path)

    def load_policy(self, path: str | Path) -> None:
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f) or {}
                self.policy.update(data)
                logger.info("Loaded custom policy from %s", path)
        except Exception as e:
            logger.error("Failed to load policy from %s: %s", path, e)

    def is_metric_allowed(self, metric_name: str) -> bool:
        """Check if metric name is in the allow-list (default-deny)."""
        allowed = self.policy.get("allow_listed_metrics", [])
        return metric_name in allowed

    @property
    def window_seconds(self) -> int:
        return int(self.policy.get("tumbling_window_s", 5))

    @property
    def retention_hours(self) -> int:
        return int(self.policy.get("retention_hours", 24))
