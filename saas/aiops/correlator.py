"""
Incident Correlation & Merging Engine — architecture.md §7.2, §7.3, task.md §5.2.

Combines:
1. Time-proximity window (alerts firing within 60s of each other).
2. Topology graph traversal (failing services connected by dependencies).
3. Coalesces 10+ noisy alerts into 1 unified Incident with a single root cause candidate.
"""

from __future__ import annotations

import time
import uuid
from typing import Any, Optional
from saas.aiops.topology import DependencyGraph, get_default_topology


class CorrelatedIncident:
    """Represents a merged multi-source incident."""

    def __init__(
        self,
        incident_id: str,
        title: str,
        root_cause_service: str,
        confidence: float,
        signals: list[dict[str, Any]],
        affected_services: list[str],
        start_ts: float,
    ):
        self.incident_id = incident_id
        self.title = title
        self.root_cause_service = root_cause_service
        self.confidence = confidence
        self.signals = signals
        self.affected_services = affected_services
        self.start_ts = start_ts
        self.status = "open"  # open | investigating | resolved

    def to_dict(self) -> dict[str, Any]:
        return {
            "incident_id": self.incident_id,
            "title": self.title,
            "root_cause_candidate": self.root_cause_service,
            "confidence": round(self.confidence, 2),
            "contributing_signals_count": len(self.signals),
            "signals": self.signals,
            "affected_services": self.affected_services,
            "start_ts": self.start_ts,
            "status": self.status,
        }


class IncidentCorrelator:
    """Coalesces incoming alerts and anomalies into root-cause incidents."""

    def __init__(self, topology: Optional[DependencyGraph] = None, window_s: float = 60.0):
        self.topology = topology or get_default_topology()
        self.window_s = window_s
        self.active_incidents: list[CorrelatedIncident] = []
        self.recent_alerts: list[dict[str, Any]] = []

    def ingest_alert(self, alert: dict[str, Any]) -> Optional[CorrelatedIncident]:
        """
        Record an incoming alert and check if it merges into an existing incident
        or spawns a new correlated incident.
        """
        t = alert.get("ts", time.time())
        service = alert.get("service", "unknown")
        metric = alert.get("metric", "general")
        severity = alert.get("severity", "warning")

        self.recent_alerts.append(alert)

        # Prune alerts older than correlation window
        cutoff = t - self.window_s
        self.recent_alerts = [a for a in self.recent_alerts if a.get("ts", 0) >= cutoff]

        # Check existing incidents for matching topology
        for incident in self.active_incidents:
            if incident.status == "open":
                # Check if this service is the root cause, a dependency, or downstream
                if (
                    service == incident.root_cause_service
                    or service in incident.affected_services
                    or service in self.topology.get_downstream_impact(incident.root_cause_service)
                ):
                    incident.signals.append(alert)
                    if service not in incident.affected_services and service != incident.root_cause_service:
                        incident.affected_services.append(service)
                    incident.confidence = min(0.98, incident.confidence + 0.05)
                    return incident

        # If 2 or more related alerts exist across topology, spawn a correlated incident
        failing_services = list({a.get("service") for a in self.recent_alerts if a.get("service")})
        if len(failing_services) >= 2 or severity == "critical":
            # Identify most foundational dependency among failing services
            root_candidate = failing_services[0]
            max_dependents = -1

            for s in failing_services:
                impacted = self.topology.get_downstream_impact(s)
                impact_score = len([x for x in impacted if x in failing_services])
                if impact_score > max_dependents:
                    max_dependents = impact_score
                    root_candidate = s

            impacted_list = [s for s in failing_services if s != root_candidate]
            new_incident = CorrelatedIncident(
                incident_id=f"inc-{uuid.uuid4().hex[:8]}",
                title=f"Cascading Degradation rooted in {root_candidate}",
                root_cause_service=root_candidate,
                confidence=0.85 if max_dependents > 0 else 0.70,
                signals=list(self.recent_alerts),
                affected_services=impacted_list,
                start_ts=t,
            )
            self.active_incidents.append(new_incident)
            return new_incident

        return None
