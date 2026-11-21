#!/usr/bin/env python3
"""
Custom Application Connector Demonstration
Shows how ANY custom user application (e.g., e-commerce, banking, or AI vision app)
connects to our AIOps Platform in 3 simple steps:
1. Generates operational telemetry (CPU, memory, requests, errors)
2. Posts allow-listed metadata to Tier 1 Local Collector (port 8080) or Cloud Ingest (port 8000)
3. Appears instantly on the Next.js Observability Dashboards
"""

import time
import uuid
import httpx

def send_telemetry_batch():
    collector_url = "http://localhost:8000/ingest"
    api_key = "test-collector-key-abc123"
    
    payload = {
        "payload_id": str(uuid.uuid4()),
        "schema_version": "1.0",
        "collector_id": "col-custom-app-01",
        "region": "ap-south-1",
        "event_ts_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "source_tz": "UTC",
        "source_id": "h_custom_app_99",
        "kind": "metric_window",
        "window_s": 5,
        "metrics": {
            "cpu_pct": {"avg": 24.5, "max": 42.0},
            "mem_pct": {"avg": 58.2, "max": 65.0},
            "latency_ms": {"avg": 8.4, "p95": 16.2},
            "request_count": {"avg": 1450.0},
            "error_rate": {"avg": 0.01}
        },
        "category": "nominal_operation",
        "severity": "info",
        "context": "Custom Application operating normally under peak load"
    }
    
    headers = {
        "Content-Type": "application/json",
        "X-Collector-Key": api_key,
    }
    
    print(f"🚀 Transmitting telemetry from Custom Application to AIOps Ingest API ({collector_url})...")
    resp = httpx.post(collector_url, json={"payloads": [payload]}, headers=headers, timeout=5.0)
    print(f"✅ Ingestion Response [{resp.status_code}]: {resp.json()}")

if __name__ == "__main__":
    send_telemetry_batch()
