"""
Canary Secret Leak Test — task 1.18, Gate 1.
Injects 50+ canary secrets in varied formats and asserts ZERO appear in any outgoing payload.
"""

import base64
import json
import uuid
from datetime import datetime, timezone
import pytest

from simulator.generator import CANARY_SECRETS
from collector.schemas import IngestPayload, PayloadKind, MetricValue
from collector.redact.scrubbers import redact_data
from collector.redact.validator import validate_and_sanitize_payload_fields
from collector.redact.pseudonym import pseudonymize_source_id


def generate_50_canary_payloads() -> list[dict]:
    """Generate 50+ diverse test cases containing planted canary secrets."""
    cases = []

    # 1. Direct canaries from simulator
    for canary in CANARY_SECRETS:
        cases.append({"raw": f"Log event: {canary} occurred on system"})
        cases.append({"data": {"message": f"Service alert: {canary}", "token": canary}})
        cases.append({"url": f"https://api.internal/v1/auth?code={canary}&env=prod"})

    # 2. Base64-encoded canaries in text
    for canary in CANARY_SECRETS[:5]:
        b64 = base64.b64encode(canary.encode()).decode()
        cases.append({"b64_log": f"ENCODED_CANARY={b64} in payload"})

    # 3. Deeply nested dictionary with canaries
    for i in range(15):
        canary = f"CANARY-generated-secret-{i}-AKIA{i:016d}"
        cases.append({
            "level1": {
                "level2": {
                    "level3": {
                        "password": canary,
                        "context": f"Failed operation with secret {canary}",
                        "nested_json": json.dumps({"inner_secret": canary}),
                    }
                }
            }
        })

    # 4. Mixed-case and delimited formats
    for i in range(10):
        canary = f"canary-credential-{uuid.uuid4().hex[:12]}"
        cases.append({
            "audit": f"AUTH FAIL: user=root pwd={canary} ip=10.0.{i}.5"
        })

    return cases


def test_zero_canary_leakage_in_outgoing_payloads():
    """
    Core Gate 1 test:
    Inject 50+ canary secrets in varied formats.
    Verify ZERO canary tokens appear in the serialized outgoing payload.
    """
    test_cases = generate_50_canary_payloads()
    assert len(test_cases) >= 50, f"Expected at least 50 test cases, got {len(test_cases)}"

    leaked_canaries = []

    for idx, case in enumerate(test_cases):
        # 1. Apply collector redaction to raw input
        clean_data = redact_data(case)

        # 2. Build IngestPayload as the collector does
        raw_str = json.dumps(clean_data)
        truncated_context = raw_str[:180]  # Respect schema context length

        payload = IngestPayload(
            payload_id=str(uuid.uuid4()),
            schema_version="1.0",
            collector_id="col-local-test",
            event_ts_utc=datetime.now(timezone.utc),
            source_id=pseudonymize_source_id(f"host-{idx}"),
            kind=PayloadKind.alert,
            category="security_test",
            context=truncated_context,
            metrics={"cpu_pct": MetricValue(avg=25.0, count=1)},
        )

        # 3. Serialize canonical payload that would cross the wire
        serialized = json.dumps(payload.model_dump(mode="json"))

        # 4. Assert zero canaries in serialized payload
        for canary in CANARY_SECRETS:
            if canary in serialized or canary.lower() in serialized.lower():
                leaked_canaries.append((canary, serialized))

        if "CANARY-" in serialized or "canary-" in serialized:
            # Check if any dynamically generated canary remained unscrubbed
            import re
            remaining = re.findall(r"(?i)CANARY-[a-zA-Z0-9_\-\.:=@/]+", serialized)
            if remaining:
                leaked_canaries.append((str(remaining), serialized))

    assert not leaked_canaries, (
        f"CRITICAL LEAK FAILURE: Found {len(leaked_canaries)} leaked secrets in egress payloads:\n"
        f"{leaked_canaries[:3]}"
    )
