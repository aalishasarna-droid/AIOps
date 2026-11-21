#!/usr/bin/env python3
"""
Vision AI Application Connector
Demonstrates connecting an external AI application (e.g., Vision AI Inference service)
into the Secure AIOps Observability Cloud.
"""

import time
import uuid
import httpx

def send_vision_telemetry():
    ingest_url = "http://localhost:8000/ingest"
    api_key = "test-collector-key-abc123"
    
    payload = {
        "payload_id": str(uuid.uuid4()),
        "schema_version": "1.0",
        "collector_id": "col-vision-ai-edge-01",
        "region": "ap-south-1",
        "event_ts_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "source_tz": "UTC",
        "source_id": "h_vision_model_tflite",
        "kind": "metric_window",
        "window_s": 5,
        "metrics": {
            "cpu_pct": {"avg": 38.2, "max": 54.0},
            "mem_pct": {"avg": 62.4, "max": 71.0},
            "latency_ms": {"avg": 14.8, "p95": 28.5},
            "fps_processed": {"avg": 29.8},
            "audio_anomalies_detected": {"avg": 0.0}
        },
        "category": "ai_inference",
        "severity": "info",
        "context": "Vision AI Audio & Video Inference Engine running nominal at 30 FPS"
    }
    
    headers = {
        "Content-Type": "application/json",
        "X-Collector-Key": api_key,
    }
    
    print(f"🚀 Transmitting telemetry from Vision AI Application to AIOps Cloud ({ingest_url})...")
    resp = httpx.post(ingest_url, json={"payloads": [payload]}, headers=headers, timeout=5.0)
    print(f"✅ Ingestion Response [{resp.status_code}]: {resp.json()}")

if __name__ == "__main__":
    send_vision_telemetry()
