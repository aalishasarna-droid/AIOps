"""
Service dependency graph and topology traversal — architecture.md §7.2, §7.3.
Enables causal root-cause analysis by mapping dependencies between services.
"""

from __future__ import annotations

from typing import Optional


class DependencyGraph:
    """
    Directed acyclic graph representing service topology.
    An edge (A -> B) means service A depends on service B.
    Therefore, failure in B cascades to failure in A.
    """

    def __init__(self):
        # source -> list of services it depends on (downstream dependencies)
        self.dependencies: dict[str, set[str]] = {}
        # service -> list of callers (upstream dependents)
        self.dependents: dict[str, set[str]] = {}

    def add_dependency(self, service: str, depends_on: str) -> None:
        """Register that `service` calls/depends on `depends_on`."""
        if service not in self.dependencies:
            self.dependencies[service] = set()
        self.dependencies[service].add(depends_on)

        if depends_on not in self.dependents:
            self.dependents[depends_on] = set()
        self.dependents[depends_on].add(service)

    def get_upstream_causes(self, failing_service: str) -> list[str]:
        """
        Traverse the graph to find potential root dependencies that this service relies upon.
        """
        visited = set()
        candidates = []

        def dfs(current: str):
            for dep in self.dependencies.get(current, []):
                if dep not in visited:
                    visited.add(dep)
                    candidates.append(dep)
                    dfs(dep)

        dfs(failing_service)
        return candidates

    def get_downstream_impact(self, root_service: str) -> list[str]:
        """Find all upstream caller services impacted when `root_service` fails."""
        visited = set()
        impacted = []

        def dfs(current: str):
            for caller in self.dependents.get(current, []):
                if caller not in visited:
                    visited.add(caller)
                    impacted.append(caller)
                    dfs(caller)

        dfs(root_service)
        return impacted


def get_default_topology() -> DependencyGraph:
    """Return default seeded topology for demo and scenarios."""
    g = DependencyGraph()
    # Web UI depends on API Gateway
    g.add_dependency("web-ui", "api-gateway")
    # API Gateway depends on Auth Service, Order Service, and Payment Service
    g.add_dependency("api-gateway", "auth-service")
    g.add_dependency("api-gateway", "order-service")
    g.add_dependency("api-gateway", "payment-service")
    # Services depend on PostgreSQL database
    g.add_dependency("auth-service", "db-primary")
    g.add_dependency("order-service", "db-primary")
    g.add_dependency("payment-service", "db-primary")
    # Payment Service also depends on Payment Gateway
    g.add_dependency("payment-service", "payment-gateway-ext")
    return g
