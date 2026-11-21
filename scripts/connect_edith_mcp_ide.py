#!/usr/bin/env python3
"""
E.D.I.T.H MCP-IDE Telemetry Connector
Streams live operational observability metrics from E.D.I.T.H MCP-IDE
(Model Context Protocol IDE) to the Secure AIOps Cloud Platform.
"""

import time
import uuid
import httpx

def send_edith_telemetry():
    ingest_url = "http://localhost:8000/ingest"
    api_key = "test-collector-key-abc123"
    
    payload = {
        "payload_id": str(uuid.uuid4()),
        "schema_version": "1.0",
        "collector_id": "col-edith-mcp-ide-01",
        "region": "ap-south-1",
        "event_ts_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "source_tz": "UTC",
        "source_id": "h_edith_mcp_ide_server",
        "kind": "metric_window",
        "window_s": 5,
        "metrics": {
            "cpu_pct": {"avg": 22.8, "max": 41.5},
            "mem_pct": {"avg": 48.6, "max": 56.0},
            "latency_ms": {"avg": 6.8, "p95": 14.2},
            "mcp_tools_active": {"avg": 12.0},
            "rpc_requests_sec": {"avg": 45.0},
            "error_rate": {"avg": 0.0}
        },
        "category": "developer_tooling",
        "severity": "info",
        "context": "E.D.I.T.H MCP-IDE running nominal with 12 active MCP tool providers"
    }
    
    headers = {
        "Content-Type": "application/json",
        "X-Collector-Key": api_key,
    }
    
    print(f"🚀 Transmitting telemetry from E.D.I.T.H MCP-IDE to AIOps Cloud ({ingest_url})...")
    resp = httpx.post(ingest_url, json={"payloads": [payload]}, headers=headers, timeout=5.0)
    print(f"✅ E.D.I.T.H MCP-IDE Ingestion Response [{resp.status_code}]: {resp.json()}")

if __name__ == "__main__":
    send_edith_telemetry()
