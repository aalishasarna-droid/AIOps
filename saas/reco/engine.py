"""
Runbook Recommendation Engine — architecture.md §8.1.
Maps incident patterns and root causes to targeted operational runbooks.
"""

from __future__ import annotations

from typing import Any, Optional


RUNBOOK_CATALOG = {
    "db_connection_spike": {
        "id": "rb-db-conn-01",
        "title": "Kill Idle Connections & Expand Pool",
        "action": "EXEC_SQL: SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle';",
        "rollback": "RELOAD_CONFIG: pgbouncer reload",
        "risk_level": "medium",
        "estimated_recovery_s": 15,
    },
    "memory_leak": {
        "id": "rb-mem-restart-02",
        "title": "Graceful Rolling Restart of Service",
        "action": "KUBECTL: rollout restart deployment/{service}",
        "rollback": "KUBECTL: rollout undo deployment/{service}",
        "risk_level": "low",
        "estimated_recovery_s": 45,
    },
    "cpu_spike": {
        "id": "rb-scale-up-03",
        "title": "Horizontal Scale Replica Count (+2)",
        "action": "KUBECTL: scale deployment/{service} --replicas=+2",
        "rollback": "KUBECTL: scale deployment/{service} --replicas=-2",
        "risk_level": "low",
        "estimated_recovery_s": 30,
    },
    "network_latency": {
        "id": "rb-reroute-04",
        "title": "Failover Traffic to Secondary Availability Zone",
        "action": "ROUTE: update dns_weight set az_b=100, az_a=0",
        "rollback": "ROUTE: update dns_weight set az_a=100, az_b=0",
        "risk_level": "high",
        "estimated_recovery_s": 60,
    },
    "auth_anomaly": {
        "id": "rb-rate-limit-05",
        "title": "Apply IP Rate Limiting & Cloudflare Under Attack Mode",
        "action": "WAF: set rate_limit 100/min on /api/v1/auth",
        "rollback": "WAF: reset rate_limit to default",
        "risk_level": "low",
        "estimated_recovery_s": 10,
    },
}


class RunbookRecommendationEngine:
    """Matches root causes to recommended runbooks."""

    def recommend_for_incident(self, incident: dict[str, Any]) -> dict[str, Any]:
        root = incident.get("root_cause_candidate", "")
        title = incident.get("title", "").lower()
        signals = str(incident.get("signals", "")).lower()

        if "db" in root.lower() or "database" in title or "pool" in signals:
            rb = dict(RUNBOOK_CATALOG["db_connection_spike"])
        elif "mem" in title or "memory" in signals:
            rb = dict(RUNBOOK_CATALOG["memory_leak"])
            rb["action"] = rb["action"].format(service=root)
            rb["rollback"] = rb["rollback"].format(service=root)
        elif "cpu" in title or "cpu" in signals:
            rb = dict(RUNBOOK_CATALOG["cpu_spike"])
            rb["action"] = rb["action"].format(service=root)
            rb["rollback"] = rb["rollback"].format(service=root)
        elif "auth" in title or "login" in signals:
            rb = dict(RUNBOOK_CATALOG["auth_anomaly"])
        else:
            rb = dict(RUNBOOK_CATALOG["network_latency"])

        return rb
