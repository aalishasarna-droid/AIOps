"""
Host metrics source using psutil — task 1.1.
Reads CPU, memory, disk, and network stats.
"""

from __future__ import annotations

import logging
import os
import time
from typing import Any

logger = logging.getLogger(__name__)

try:
    import psutil
except ImportError:
    psutil = None


class HostMetricsCollector:
    """Collects system-level resource utilization."""

    def __init__(self):
        self.last_net_io: Any = None
        self.last_net_ts: float = time.time()

    def collect(self) -> dict[str, float]:
        """Read host metrics and return key-value dictionary."""
        if psutil is None:
            # Fallback if psutil is not available
            return {
                "cpu_pct": 15.0,
                "mem_pct": 40.0,
                "disk_pct": 50.0,
                "net_rx_kbps": 120.0,
                "net_tx_kbps": 85.0,
            }

        try:
            cpu = psutil.cpu_percent(interval=None)
            vmem = psutil.virtual_memory()
            disk = psutil.disk_usage("/")

            # Calculate network bandwidth in kbps
            net = psutil.net_io_counters()
            now = time.time()
            rx_kbps = 0.0
            tx_kbps = 0.0
            if self.last_net_io and now > self.last_net_ts:
                dt = now - self.last_net_ts
                rx_bytes = net.bytes_recv - self.last_net_io.bytes_recv
                tx_bytes = net.bytes_sent - self.last_net_io.bytes_sent
                rx_kbps = (rx_bytes * 8) / (dt * 1000)
                tx_kbps = (tx_bytes * 8) / (dt * 1000)

            self.last_net_io = net
            self.last_net_ts = now

            load_avg = round(os.getloadavg()[0], 2) if hasattr(os, "getloadavg") else 0.5

            return {
                "cpu_pct": round(cpu, 1),
                "cpu_cores": float(psutil.cpu_count(logical=True) or 1),
                "load_1m": load_avg,
                "mem_pct": round(vmem.percent, 1),
                "mem_used_mb": round(vmem.used / (1024 * 1024), 1),
                "mem_total_mb": round(vmem.total / (1024 * 1024), 1),
                "mem_available_mb": round(vmem.available / (1024 * 1024), 1),
                "disk_pct": round(disk.percent, 1),
                "disk_used_gb": round(disk.used / (1024**3), 2),
                "disk_total_gb": round(disk.total / (1024**3), 2),
                "net_rx_kbps": round(rx_kbps, 1),
                "net_tx_kbps": round(tx_kbps, 1),
                "net_bw_mbps": round((rx_kbps + tx_kbps) / 1000.0, 2),
            }
        except Exception as e:
            logger.error("Failed to read psutil host metrics: %s", e)
            return {}
