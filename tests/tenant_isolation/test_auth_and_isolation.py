"""
Tenant isolation and Ingest API authentication tests — task 2.2-2.5.
Ref: architecture.md §6.4
"""

import uuid
from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient

from saas.ingest_api.main import app, SEEN_PAYLOADS
from collector.schemas import IngestBatch, IngestPayload, PayloadKind, MetricValue


@pytest.fixture
def client():
    SEEN_PAYLOADS.clear()
    return TestClient(app)


def make_valid_payload():
    return {
        "payload_id": str(uuid.uuid4()),
        "schema_version": "1.0",
        "collector_id": "col-local-01",
        "event_ts_utc": datetime.now(timezone.utc).isoformat(),
        "source_id": "src_1234567890abcdef",
        "kind": "metric_window",
        "window_s": 5,
        "metrics": {
            "cpu_pct": {"avg": 25.5, "count": 5}
        },
    }


def test_missing_api_key_returns_401(client):
    payload = make_valid_payload()
    resp = client.post("/ingest", json={"payloads": [payload]})
    assert resp.status_code == 401
    assert "Missing X-Collector-Key" in resp.json()["detail"]


def test_invalid_api_key_returns_403(client):
    payload = make_valid_payload()
    resp = client.post(
        "/ingest",
        json={"payloads": [payload]},
        headers={"X-Collector-Key": "invalid-bogus-key"},
    )
    assert resp.status_code == 403


def test_valid_payload_accepted(client):
    payload = make_valid_payload()
    resp = client.post(
        "/ingest",
        json={"payloads": [payload]},
        headers={"X-Collector-Key": "test-collector-key-abc123"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["accepted"] == 1
    assert data["duplicates"] == 0
    assert len(data["receipts"]) == 1
    assert data["receipts"][0]["payload_id"] == payload["payload_id"]
    assert data["receipts"][0]["status"] == "accepted"
    # Derived tenant_id
    assert data["receipts"][0]["tenant_id"] == "00000000-0000-0000-0000-000000000001"


def test_reject_extra_fields_default_deny(client):
    """Pydantic extra='forbid' must reject unknown/unregistered fields."""
    payload = make_valid_payload()
    # Attempt to inject unknown / sensitive field
    payload["unauthorized_raw_logs"] = "DROP TABLE users;"
    resp = client.post(
        "/ingest",
        json={"payloads": [payload]},
        headers={"X-Collector-Key": "test-collector-key-abc123"},
    )
    assert resp.status_code == 422


def test_idempotency_duplicate_handling(client):
    payload = make_valid_payload()
    headers = {"X-Collector-Key": "test-collector-key-abc123"}

    # First send
    resp1 = client.post("/ingest", json={"payloads": [payload]}, headers=headers)
    assert resp1.status_code == 200
    assert resp1.json()["accepted"] == 1

    # Second send with identical payload_id
    resp2 = client.post("/ingest", json={"payloads": [payload]}, headers=headers)
    assert resp2.status_code == 200
    assert resp2.json()["accepted"] == 0
    assert resp2.json()["duplicates"] == 1
    assert resp2.json()["receipts"][0]["status"] == "duplicate"
