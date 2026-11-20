"""
Regional Data Residency and Cross-Region Isolation Tests.
Ref: architecture.md §6.2, §15, task.md Phase 7 (Global-Ready Residency).

Verifies:
1. HTTP 403 wrong-region rejection when an EU tenant collector hits the ap-south-1 node.
2. HTTP 200 acceptance when an ap-south-1 tenant hits the ap-south-1 node.
3. Control-plane enrollment endpoint correctly resolves tenant -> regional ingest URL.
4. Cross-region zero-row verification endpoint proves data isolation.
5. Ingest payload with explicit mismatched region is rejected with HTTP 403.
"""

import uuid
from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient

from saas.ingest_api.main import app, SEEN_PAYLOADS


@pytest.fixture
def client():
    SEEN_PAYLOADS.clear()
    return TestClient(app)


def make_valid_payload(region: str = None):
    p = {
        "payload_id": str(uuid.uuid4()),
        "schema_version": "1.0",
        "collector_id": "col-local-01",
        "event_ts_utc": datetime.now(timezone.utc).isoformat(),
        "source_id": "src_1234567890abcdef",
        "kind": "metric_window",
        "window_s": 5,
        "metrics": {
            "cpu_pct": {"avg": 22.4, "count": 5}
        },
    }
    if region:
        p["region"] = region
    return p


def test_wrong_region_rejection_returns_403(client):
    """
    Task 7.2 & Architecture §6.2 / §15:
    German tenant collector (col-health-key-9988) sending to ap-south-1 node
    must be rejected with HTTP 403 Forbidden.
    """
    payload = make_valid_payload()
    resp = client.post(
        "/ingest",
        json={"payloads": [payload]},
        headers={"X-Collector-Key": "col-health-key-9988"},
    )
    assert resp.status_code == 403
    detail = resp.json()["detail"]
    assert "Wrong-region rejection" in detail
    assert "eu-central-1" in detail
    assert "ap-south-1" in detail


def test_correct_region_accepted(client):
    """
    Authorized collector in the matching region (ap-south-1) is accepted.
    """
    payload = make_valid_payload()
    resp = client.post(
        "/ingest",
        json={"payloads": [payload]},
        headers={"X-Collector-Key": "test-collector-key-abc123"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["accepted"] == 1
    assert data["receipts"][0]["status"] == "accepted"


def test_mismatched_payload_region_rejected(client):
    """
    Even if authenticated, if the payload explicitly declares a cross-region
    origin (e.g. eu-central-1) on the ap-south node, it must be rejected with 403.
    """
    payload = make_valid_payload(region="eu-central-1")
    resp = client.post(
        "/ingest",
        json={"payloads": [payload]},
        headers={"X-Collector-Key": "test-collector-key-abc123"},
    )
    assert resp.status_code == 403
    assert "Payload region 'eu-central-1' does not match" in resp.json()["detail"]


def test_control_plane_enrollment_routing(client):
    """
    Task 7.1: Control-plane collector enrollment returns regional ingest URL.
    """
    # EU tenant
    resp_eu = client.get("/api/control-plane/enrollment/col-health-key-9988")
    assert resp_eu.status_code == 200
    eu_data = resp_eu.json()
    assert eu_data["assigned_region"] == "eu-central-1"
    assert "8001" in eu_data["external_ingest_url"]

    # Indian tenant
    resp_in = client.get("/api/control-plane/enrollment/test-collector-key-abc123")
    assert resp_in.status_code == 200
    in_data = resp_in.json()
    assert in_data["assigned_region"] == "ap-south-1"
    assert "8000" in in_data["external_ingest_url"]


def test_control_plane_regions_topology(client):
    """
    Control-plane returns topology of regional nodes.
    """
    resp = client.get("/api/control-plane/regions")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "operational"
    assert data["residency_enforcement"] == "strict_isolation"
    assert len(data["regions"]) >= 2


def test_cross_region_zero_row_isolation(client):
    """
    Task 7.3 & 7.6: Live cross-region zero-row check.
    Proves German tenant has 0 rows in ap-south-1 node.
    """
    resp = client.get("/api/residency/verify")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "verified"
    german_tenant = next((t for t in data["tenants"] if "German" in t["tenant_name"]), None)
    assert german_tenant is not None
    assert german_tenant["rows_in_current_store"] == 0
    assert german_tenant["cross_region_zero_rows_verified"] is True


def test_residency_simulation_endpoint(client):
    """
    Simulation endpoint returns 403 rejection proof for the live dashboard UI.
    """
    resp = client.post("/api/residency/test-wrong-region")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "rejected_403"
    assert data["http_status"] == 403
    assert "Wrong-region rejection" in data["detail"]
