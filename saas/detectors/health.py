"""
Health state evaluator — architecture.md §7.1, task.md §3.1.
Calculates the 4-state health: Healthy | Degraded | Critical | Stale.
"""

from __future__ import annotations

import time
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional


class HealthState(str, Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    CRITICAL = "critical"
    STALE = "stale"


class FleetHealthEvaluator:
    """Evaluates fleet node health based on incoming metrics and freshness."""

    def __init__(self, stale_threshold_s: float = 30.0):
        self.stale_threshold_s = stale_threshold_s

    def evaluate_node_health(
        self,
        last_seen_ts: float,
        metrics: dict[str, Any],
        alerts_count: int = 0,
        now: Optional[float] = None,
    ) -> tuple[HealthState, list[str]]:
        """
        Evaluate health state and return (HealthState, reasons).
        """
        current_time = now or time.time()
        reasons = []

        # 1. Check for stale / offline node
        time_since_seen = current_time - last_seen_ts
        if time_since_seen > self.stale_threshold_s:
            reasons.append(f"Heartbeat missing for {int(time_since_seen)}s (threshold: {self.stale_threshold_s}s)")
            return HealthState.STALE, reasons

        # 2. Extract metrics
        cpu = metrics.get("cpu_pct", {}).get("avg", 0.0) if isinstance(metrics.get("cpu_pct"), dict) else float(metrics.get("cpu_pct", 0.0))
        mem = metrics.get("mem_pct", {}).get("avg", 0.0) if isinstance(metrics.get("mem_pct"), dict) else float(metrics.get("mem_pct", 0.0))
        latency = metrics.get("latency_ms", {}).get("avg", 0.0) if isinstance(metrics.get("latency_ms"), dict) else float(metrics.get("latency_ms", 0.0))
        packet_loss = metrics.get("packet_loss_pct", {}).get("avg", 0.0) if isinstance(metrics.get("packet_loss_pct"), dict) else float(metrics.get("packet_loss_pct", 0.0))

        # 3. Check Critical conditions
        if cpu >= 95.0:
            reasons.append(f"CPU critical: {cpu}% >= 95%")
        if mem >= 95.0:
            reasons.append(f"Memory critical: {mem}% >= 95%")
        if packet_loss >= 20.0:
            reasons.append(f"Packet loss severe: {packet_loss}%")
        if alerts_count >= 5:
            reasons.append(f"Active critical alert flood: {alerts_count} alerts")

        if reasons:
            return HealthState.CRITICAL, reasons

        # 4. Check Degraded conditions
        if cpu >= 80.0:
            reasons.append(f"CPU elevated: {cpu}%")
        if mem >= 80.0:
            reasons.append(f"Memory elevated: {mem}%")
        if latency >= 200.0:
            reasons.append(f"High network latency: {latency}ms")
        if packet_loss >= 2.0:
            reasons.append(f"Packet loss detected: {packet_loss}%")
        if alerts_count >= 1:
            reasons.append(f"Active warning alerts: {alerts_count}")

        if reasons:
            return HealthState.DEGRADED, reasons

        return HealthState.HEALTHY, ["All systems nominal"]
