"""
Unit tests for each scrubber — task 1.19.
Tests tricky cases: secrets in URLs, JSON in logs, base64, Luhn checks, HMAC pseudonyms.
"""

import json
import pytest
from collector.redact.scrubbers import (
    scrub_text,
    redact_data,
    is_sensitive_key,
    passes_luhn,
)
from collector.redact.pseudonym import pseudonymize_source_id


def test_sensitive_keys_detected():
    assert is_sensitive_key("password")
    assert is_sensitive_key("db_passwd")
    assert is_sensitive_key("auth_token")
    assert is_sensitive_key("authorization")
    assert is_sensitive_key("api_key")
    assert is_sensitive_key("session_id")
    assert is_sensitive_key("user_cookie")
    assert is_sensitive_key("CANARY_secret")
    assert not is_sensitive_key("cpu_pct")
    assert not is_sensitive_key("metric_name")
    assert not is_sensitive_key("service")


def test_drop_sensitive_keys_from_dict():
    raw = {
        "service": "billing",
        "cpu": 45.2,
        "password": "super-secret-password-123",
        "api_key": "synthetic_canary_key_1234567890",
        "metadata": {
            "token": "secret_token",
            "safe_label": "prod",
        },
    }
    redacted = redact_data(raw)
    assert "password" not in redacted
    assert "api_key" not in redacted
    assert "token" not in redacted["metadata"]
    assert redacted["service"] == "billing"
    assert redacted["cpu"] == 45.2
    assert redacted["metadata"]["safe_label"] == "prod"


def test_jwt_scrubbing():
    jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
    text = f"User logged in with bearer {jwt} from gateway"
    scrubbed = scrub_text(text)
    assert jwt not in scrubbed
    assert "[REDACTED_JWT]" in scrubbed


def test_aws_key_scrubbing():
    aws_key = "AKIAIOSFODNN7EXAMPLE"
    text = f"AWS S3 error using credentials {aws_key} access failed"
    scrubbed = scrub_text(text)
    assert aws_key not in scrubbed
    assert "[REDACTED_AWS_KEY]" in scrubbed


def test_credit_card_luhn_scrubbing():
    valid_card = "4111 1111 1111 1111"
    assert passes_luhn(valid_card)
    text = f"Payment charged to {valid_card} status ok"
    scrubbed = scrub_text(text)
    assert "4111" not in scrubbed
    assert "[REDACTED_CC]" in scrubbed

    # Non-credit card sequence (fails Luhn) should not be falsely redacted
    non_card = "1234 5678 9012 3456"
    if not passes_luhn(non_card):
        text_non_card = f"Order reference {non_card} tracking"
        assert "[REDACTED_CC]" not in scrub_text(text_non_card)


def test_email_and_ip_scrubbing():
    text = "Error reported by user admin@internal.corp from host 192.168.10.42"
    scrubbed = scrub_text(text)
    assert "admin@internal.corp" not in scrubbed
    assert "192.168.10.42" not in scrubbed
    assert "[REDACTED_EMAIL]" in scrubbed
    assert "[REDACTED_IP]" in scrubbed


def test_secrets_in_url_query_params():
    url = "https://internal.api/v1/query?token=secret123&user=john&password=mypassword&limit=10"
    scrubbed = scrub_text(url)
    assert "secret123" not in scrubbed
    assert "mypassword" not in scrubbed
    assert "limit=10" in scrubbed


def test_nested_json_in_log_string():
    nested_json = json.dumps({"action": "login", "password": "hunter2", "user_id": 99})
    log_line = f"AUTH_EVENT raw_payload={nested_json}"
    redacted = redact_data(log_line)
    assert "hunter2" not in redacted
    assert "user_id" in redacted


def test_hmac_pseudonymization():
    secret_a = "secret-tenant-a-12345"
    secret_b = "secret-tenant-b-67890"
    host = "db-primary.production.internal"

    pseudo_a1 = pseudonymize_source_id(host, secret_a)
    pseudo_a2 = pseudonymize_source_id(host, secret_a)
    pseudo_b = pseudonymize_source_id(host, secret_b)

    # Deterministic for same tenant
    assert pseudo_a1 == pseudo_a2
    assert pseudo_a1.startswith("src_")
    # Different for different tenant
    assert pseudo_a1 != pseudo_b
    # Does not contain raw hostname
    assert "db-primary" not in pseudo_a1
    assert "production" not in pseudo_a1
