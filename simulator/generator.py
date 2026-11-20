"""
Simulator v1 — Generates synthetic telemetry for the AIOps platform.

Produces:
  - Host metrics (CPU, memory, disk, network)
  - Syslog-like lines with planted canary secrets
  - Failed-login bursts
  - Latency/packet-loss spikes
  - Various fault-injection scenarios

Ref: architecture.md §11 (Simulator), task.md §0.6-0.7
"""

from __future__ import annotations

import json
import math
import os
import random
import string
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Generator

# ---------------------------------------------------------------------------
# Canary secrets — these MUST NEVER reach SaaS (leak test verifies this)
# ---------------------------------------------------------------------------

CANARY_SECRETS = [
    "CANARY-password-hunter2",
    "CANARY-token-eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.fake",
    "CANARY-aws-AKIAIOSFODNN7EXAMPLE",
    "CANARY-api-key-SAMPLE_CANARY_TOKEN_VAL_42",
    "CANARY-jwt-eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJjYW5hcnkifQ.sig",
    "CANARY-email-admin@secretcorp.internal",
    "CANARY-ip-192.168.1.42",
    "CANARY-credit-card-4111111111111111",
    "CANARY-cookie-session=abc123secret456",
    "CANARY-authorization-Bearer sk-proj-abc123def456",
]


# ---------------------------------------------------------------------------
# Scenario generators
# ---------------------------------------------------------------------------

def _base_metrics(t: float, noise: float = 0.05) -> dict[str, float]:
    """Normal host metrics with diurnal pattern and noise."""
    hour = datetime.fromtimestamp(t, tz=timezone.utc).hour
    # Diurnal: higher during business hours (8-18)
    diurnal = 0.3 + 0.4 * max(0, 1 - abs(hour - 13) / 5)

    cpu = max(0, min(100, 30 * diurnal + random.gauss(0, noise * 30)))
    mem = max(0, min(100, 55 + 10 * diurnal + random.gauss(0, noise * 10)))
    disk = max(0, min(100, 42 + random.gauss(0, 1)))
    net_bw_mbps = max(0, 50 * diurnal + random.gauss(0, noise * 50))
    latency_ms = max(0.5, 5 + random.gauss(0, 1))
    packet_loss_pct = max(0, random.gauss(0.1, 0.05))

    return {
        "cpu_pct": round(cpu, 1),
        "mem_pct": round(mem, 1),
        "disk_pct": round(disk, 1),
        "net_bw_mbps": round(net_bw_mbps, 2),
        "latency_ms": round(latency_ms, 2),
        "packet_loss_pct": round(packet_loss_pct, 3),
    }


def _syslog_line(t: float, inject_secret: bool = False) -> str:
    """Generate a syslog-like log line, optionally injecting a canary secret."""
    ts = datetime.fromtimestamp(t, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
    app = random.choice(["nginx", "postgres", "app-server", "auth-service", "cron"])
    pid = random.randint(100, 65535)

    messages = [
        f"Connection accepted from 10.0.{random.randint(0,255)}.{random.randint(1,254)}",
        f"Query completed in {random.randint(1, 500)}ms",
        f"Request processed successfully, status=200",
        f"Worker {random.randint(1,8)} idle",
        f"Cache hit ratio: {random.uniform(0.8, 0.99):.2%}",
    ]

    if inject_secret:
        secret = random.choice(CANARY_SECRETS)
        messages = [
            f"DEBUG: auth token={secret}",
            f"Config loaded: password={secret}",
            f"API response: authorization: Bearer {secret}",
            f"Session cookie set: {secret}",
            f"Connecting with key={secret}",
        ]

    msg = random.choice(messages)
    return f"{ts} {app}[{pid}]: {msg}"


class Scenario:
    """Base class for telemetry scenarios."""

    def __init__(self, name: str, sources: list[str] | None = None):
        self.name = name
        self.sources = sources or ["web-01", "app-01", "db-01", "api-01"]

    def generate(self, t: float) -> list[dict[str, Any]]:
        """Generate events for the given timestamp. Override in subclasses."""
        raise NotImplementedError


class NormalScenario(Scenario):
    """Normal operation — no anomalies, diurnal pattern."""

    def __init__(self):
        super().__init__("normal")

    def generate(self, t: float) -> list[dict[str, Any]]:
        events = []
        for src in self.sources:
            metrics = _base_metrics(t)
            # Every 10th event, inject a secret into syslog (for leak testing)
            syslog = _syslog_line(t, inject_secret=(random.random() < 0.1))
            events.append({
                "source": src,
                "metrics": metrics,
                "syslog": syslog,
                "category": None,
                "severity": "info",
            })
        return events


class SpikeScenario(Scenario):
    """Sudden CPU spike on one source."""

    def __init__(self):
        super().__init__("spike")
        self._spike_start: float | None = None
        self._spike_source = "app-01"

    def generate(self, t: float) -> list[dict[str, Any]]:
        if self._spike_start is None:
            self._spike_start = t + random.uniform(20, 40)

        events = []
        for src in self.sources:
            metrics = _base_metrics(t)
            if src == self._spike_source and t >= self._spike_start:
                duration = t - self._spike_start
                if duration < 60:  # spike lasts ~60s
                    metrics["cpu_pct"] = min(100, 90 + random.gauss(5, 2))
                    metrics["latency_ms"] = max(1, 200 + random.gauss(50, 20))
            events.append({
                "source": src,
                "metrics": metrics,
                "syslog": _syslog_line(t, inject_secret=(random.random() < 0.1)),
                "category": "performance_degradation" if metrics["cpu_pct"] > 85 else None,
                "severity": "critical" if metrics["cpu_pct"] > 90 else "info",
            })
        return events


class MemoryLeakScenario(Scenario):
    """Gradual memory increase over time."""

    def __init__(self):
        super().__init__("memory_leak")
        self._start_time: float | None = None

    def generate(self, t: float) -> list[dict[str, Any]]:
        if self._start_time is None:
            self._start_time = t

        events = []
        elapsed = t - self._start_time
        for src in self.sources:
            metrics = _base_metrics(t)
            if src == "app-01":
                # Memory grows 0.5% per minute
                leak = min(45, elapsed / 60 * 0.5)
                metrics["mem_pct"] = min(100, metrics["mem_pct"] + leak)
            events.append({
                "source": src,
                "metrics": metrics,
                "syslog": _syslog_line(t),
                "category": "resource_exhaustion" if metrics["mem_pct"] > 90 else None,
                "severity": "critical" if metrics["mem_pct"] > 95 else (
                    "warning" if metrics["mem_pct"] > 85 else "info"
                ),
            })
        return events


class DBOutageCascadeScenario(Scenario):
    """
    DB goes unhealthy → app errors rise → API latency spikes → web errors.
    This is the key scenario for incident correlation testing.
    """

    def __init__(self):
        super().__init__("db_outage_cascade")
        self._cascade_start: float | None = None

    def generate(self, t: float) -> list[dict[str, Any]]:
        if self._cascade_start is None:
            self._cascade_start = t + random.uniform(15, 30)

        events = []
        elapsed = max(0, t - self._cascade_start) if t >= self._cascade_start else 0

        for src in self.sources:
            metrics = _base_metrics(t)
            category = None
            severity = "info"

            if elapsed > 0:
                if src == "db-01":
                    # DB: immediate CPU/memory spike, connection errors
                    metrics["cpu_pct"] = min(100, 85 + random.gauss(10, 3))
                    metrics["mem_pct"] = min(100, 90 + random.gauss(5, 2))
                    metrics["latency_ms"] = max(1, 500 + random.gauss(200, 50))
                    category = "database_degradation"
                    severity = "critical"

                elif src == "app-01" and elapsed > 12:
                    # App: errors start ~12s after DB
                    metrics["latency_ms"] = max(1, 300 + random.gauss(100, 30))
                    metrics["cpu_pct"] = min(100, 70 + random.gauss(10, 5))
                    category = "application_error"
                    severity = "critical"

                elif src == "api-01" and elapsed > 20:
                    # API: timeouts start ~20s after DB
                    metrics["latency_ms"] = max(1, 1000 + random.gauss(500, 100))
                    category = "timeout"
                    severity = "critical"

                elif src == "web-01" and elapsed > 31:
                    # Web: errors visible ~31s after DB
                    metrics["latency_ms"] = max(1, 2000 + random.gauss(500, 200))
                    category = "service_unavailable"
                    severity = "warning"

            events.append({
                "source": src,
                "metrics": metrics,
                "syslog": _syslog_line(t, inject_secret=(random.random() < 0.1)),
                "category": category,
                "severity": severity,
            })
        return events


class LoginBurstScenario(Scenario):
    """Burst of failed login attempts — security scenario."""

    def __init__(self):
        super().__init__("login_burst")
        self._burst_start: float | None = None

    def generate(self, t: float) -> list[dict[str, Any]]:
        if self._burst_start is None:
            self._burst_start = t + random.uniform(10, 25)

        events = []
        for src in self.sources:
            metrics = _base_metrics(t)
            events.append({
                "source": src,
                "metrics": metrics,
                "syslog": _syslog_line(t),
                "category": None,
                "severity": "info",
            })

        # Add failed login events during burst
        if t >= self._burst_start:
            elapsed = t - self._burst_start
            if elapsed < 120:  # burst lasts 2 min
                count = random.randint(5, 20)
                events.append({
                    "source": "auth-service",
                    "metrics": {},
                    "syslog": "",
                    "failed_logins": {
                        "count": count,
                        "window_s": 5,
                        "distinct_sources": random.randint(2, min(count, 10)),
                        "severity": "critical" if count > 15 else "warning",
                    },
                    "category": "auth_anomaly",
                    "severity": "critical" if count > 15 else "warning",
                })
        return events


class NetLatencyScenario(Scenario):
    """Network latency degradation."""

    def __init__(self):
        super().__init__("net_latency")
        self._degrade_start: float | None = None

    def generate(self, t: float) -> list[dict[str, Any]]:
        if self._degrade_start is None:
            self._degrade_start = t + random.uniform(15, 30)

        events = []
        for src in self.sources:
            metrics = _base_metrics(t)
            if t >= self._degrade_start:
                elapsed = t - self._degrade_start
                # Latency ramps up gradually
                ramp = min(1.0, elapsed / 30)
                metrics["latency_ms"] = max(1, 5 + 500 * ramp + random.gauss(0, 20))
                metrics["packet_loss_pct"] = max(0, 0.1 + 15 * ramp + random.gauss(0, 1))
            events.append({
                "source": src,
                "metrics": metrics,
                "syslog": _syslog_line(t),
                "category": "network_degradation" if metrics.get("latency_ms", 0) > 100 else None,
                "severity": "critical" if metrics.get("packet_loss_pct", 0) > 5 else "info",
            })
        return events


# ---------------------------------------------------------------------------
# Scenario registry
# ---------------------------------------------------------------------------

SCENARIOS: dict[str, type[Scenario]] = {
    "normal": NormalScenario,
    "spike": SpikeScenario,
    "memory_leak": MemoryLeakScenario,
    "db_outage_cascade": DBOutageCascadeScenario,
    "login_burst": LoginBurstScenario,
    "net_latency": NetLatencyScenario,
}


def run_simulator(
    scenario_name: str = "normal",
    interval_s: float = 5.0,
    duration_s: float | None = None,
) -> Generator[list[dict[str, Any]], None, None]:
    """
    Run the simulator as a generator, yielding batches of events.

    Args:
        scenario_name: One of SCENARIOS keys.
        interval_s: Seconds between batches.
        duration_s: Total duration (None = infinite).

    Yields:
        List of event dicts per tick.
    """
    scenario_cls = SCENARIOS.get(scenario_name)
    if scenario_cls is None:
        raise ValueError(f"Unknown scenario: {scenario_name}. Available: {list(SCENARIOS.keys())}")

    scenario = scenario_cls()
    start = time.time()

    while True:
        t = time.time()
        if duration_s and (t - start) >= duration_s:
            break

        events = scenario.generate(t)
        yield events
        time.sleep(interval_s)


def generate_telemetry_stream(
    scenario: str = "normal",
    interval_s: float = 2.0,
    total_ticks: int = 30,
) -> Generator[dict[str, Any], None, None]:
    """Generate stream of individual telemetry event dictionaries."""
    scenario_cls = SCENARIOS.get(scenario, NormalScenario)
    instance = scenario_cls()
    ticks = 0
    while ticks < total_ticks:
        t = time.time()
        events = instance.generate(t)
        for ev in events:
            ev["_ts"] = datetime.now(timezone.utc).isoformat()
            yield ev
        ticks += 1


# ---------------------------------------------------------------------------
# CLI entrypoint
# ---------------------------------------------------------------------------

def main():
    """Run the simulator and print events as JSON lines."""
    scenario_name = os.getenv("SIMULATOR_SCENARIO", "normal")
    interval_s = float(os.getenv("SIMULATOR_INTERVAL_S", "5"))

    print(f"[simulator] Starting scenario={scenario_name} interval={interval_s}s")

    for events in run_simulator(scenario_name, interval_s):
        for event in events:
            event["_ts"] = datetime.now(timezone.utc).isoformat()
            print(json.dumps(event))


if __name__ == "__main__":
    main()
