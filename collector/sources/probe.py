"""
Probe source — task 1.2.
Measures latency and packet loss (TCP connect) to configured targets.
"""

from __future__ import annotations

import logging
import socket
import time
from typing import Sequence

logger = logging.getLogger(__name__)


import os

class NetworkProbe:
    """Probes host/port targets to measure latency and availability."""

    def __init__(self, targets: Optional[Sequence[tuple[str, int]]] = None):
        if targets is None:
            ingest_host = os.getenv("INGEST_HOST", "ingest-api")
            ingest_port = int(os.getenv("INGEST_PORT", "8000"))
            self.targets = [(ingest_host, ingest_port)]
        else:
            self.targets = list(targets)

    def probe_target(self, host: str, port: int, timeout_s: float = 1.0) -> tuple[bool, float]:
        """Attempt TCP connection and measure elapsed milliseconds."""
        start = time.perf_counter()
        try:
            with socket.create_connection((host, port), timeout=timeout_s):
                elapsed_ms = (time.perf_counter() - start) * 1000.0
                return True, elapsed_ms
        except Exception:
            return False, timeout_s * 1000.0

    def collect(self) -> dict[str, float]:
        """Probe all configured targets and return average latency and packet loss."""
        if not self.targets:
            return {"latency_ms": 1.0, "packet_loss_pct": 0.0}

        latencies = []
        losses = 0
        for host, port in self.targets:
            success, latency = self.probe_target(host, port)
            latencies.append(latency)
            if not success:
                losses += 1

        avg_latency = sum(latencies) / len(latencies)
        loss_pct = (losses / len(self.targets)) * 100.0

        return {
            "latency_ms": round(avg_latency, 2),
            "packet_loss_pct": round(loss_pct, 1),
        }
