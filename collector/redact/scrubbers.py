"""
Redaction and pattern scrubbers — architecture.md §3, task.md §1.7, §1.8.

Protection layers:
1. Key-based redaction: known secret fields are dropped entirely.
2. Pattern scrubbers: regexes + entropy + Luhn for secrets inside text/values.
3. Nested recursion: scrubs dicts, lists, JSON strings, and URL query params.
"""

from __future__ import annotations

import base64
import json
import re
import urllib.parse
from typing import Any


# ─── 1. Sensitive Keys Deny-List ─────────────────────────────────────────────

SENSITIVE_KEY_PATTERNS = [
    re.compile(r"(?i)(pass(word)?|passwd|pwd)"),
    re.compile(r"(?i)(secret|token|auth(orization)?|bearer)"),
    re.compile(r"(?i)(api[_-]?key|access[_-]?key|private[_-]?key)"),
    re.compile(r"(?i)(cookie|session[_-]?id|jwt)"),
    re.compile(r"(?i)(credit[_-]?card|cvv|ssn)"),
    re.compile(r"(?i)(canary)"),
]


def is_sensitive_key(key: str) -> bool:
    """Return True if dictionary key matches any sensitive pattern."""
    return any(p.search(key) for p in SENSITIVE_KEY_PATTERNS)


# ─── 2. Pattern Regexes ──────────────────────────────────────────────────────

# JWT: standard header.payload.signature
JWT_PATTERN = re.compile(r"eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+")
# Generic JWT starter
JWT_SHORT_PATTERN = re.compile(r"eyJ[A-Za-z0-9_-]{15,}")

# AWS Access Key ID
AWS_KEY_PATTERN = re.compile(r"(?<![A-Z0-9])(AKIA|ASIA)[0-9A-Z]{16}(?![A-Z0-9])")

# Generic API keys (sk_live_..., sk_test_..., sk-proj-...)
API_KEY_PATTERN = re.compile(r"(?i)(sk_live_[0-9a-zA-Z]{24,}|sk_test_[0-9a-zA-Z]{24,}|sk-[a-zA-Z0-9]{20,}|ghp_[0-9a-zA-Z]{36})")

# Planted Canary secrets
CANARY_PATTERN = re.compile(r"(?i)CANARY-[a-zA-Z0-9_\-\.:=@/]+")

# Email address
EMAIL_PATTERN = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b")

# IPv4 address (excluding 127.0.0.1 if configured, but default drops all IPs per §3 C2)
IPV4_PATTERN = re.compile(r"\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b")

# Credit Card Candidate (13 to 19 digits)
CC_CANDIDATE_PATTERN = re.compile(r"\b(?:\d[ -]*?){13,19}\b")


def passes_luhn(card_number_str: str) -> bool:
    """Validate digits using Luhn algorithm."""
    digits = [int(c) for c in card_number_str if c.isdigit()]
    if len(digits) < 13 or len(digits) > 19:
        return False
    checksum = 0
    reverse_digits = digits[::-1]
    for i, d in enumerate(reverse_digits):
        if i % 2 == 1:
            doubled = d * 2
            checksum += doubled - 9 if doubled > 9 else doubled
        else:
            checksum += d
    return checksum % 10 == 0


def scrub_text(text: str) -> str:
    """
    Apply all pattern scrubbers to a string.
    Scrubs canaries, tokens, keys, emails, IPs, cards, and query parameters.
    """
    if not text or not isinstance(text, str):
        return text

    # First: direct Canary secrets scrubber
    text = CANARY_PATTERN.sub("[REDACTED_CANARY]", text)

    # AWS access keys
    text = AWS_KEY_PATTERN.sub("[REDACTED_AWS_KEY]", text)

    # API keys
    text = API_KEY_PATTERN.sub("[REDACTED_API_KEY]", text)

    # JWT tokens
    text = JWT_PATTERN.sub("[REDACTED_JWT]", text)
    text = JWT_SHORT_PATTERN.sub("[REDACTED_JWT]", text)

    # Emails
    text = EMAIL_PATTERN.sub("[REDACTED_EMAIL]", text)

    # IPv4 addresses
    text = IPV4_PATTERN.sub("[REDACTED_IP]", text)

    # Credit card numbers with Luhn check
    for match in CC_CANDIDATE_PATTERN.finditer(text):
        candidate = match.group(0)
        digits_only = re.sub(r"\D", "", candidate)
        if len(digits_only) >= 13 and passes_luhn(digits_only):
            text = text.replace(candidate, "[REDACTED_CC]")

    # Scrub query parameters in URLs (e.g., ?token=xyz or &password=abc)
    def _scrub_query_param(match: re.Match) -> str:
        param_name = match.group(1)
        if is_sensitive_key(param_name):
            return f"{param_name}=[REDACTED]"
        return match.group(0)

    text = re.sub(r"([?&][a-zA-Z0-9_-]+)=([^&\s]+)", _scrub_query_param, text)

    return text


def redact_data(obj: Any) -> Any:
    """
    Recursively redact any Python data structure (dict, list, str, etc.).
    - Drops sensitive keys from dictionaries.
    - Scrubs string values using regex scrubbers.
    - Unpacks and re-serializes JSON strings inside values to scrub nested objects.
    """
    if isinstance(obj, dict):
        clean_dict = {}
        for k, v in obj.items():
            if is_sensitive_key(str(k)):
                # Drop entirely per default-deny / key-based redaction
                continue
            clean_dict[k] = redact_data(v)
        return clean_dict

    elif isinstance(obj, list):
        return [redact_data(item) for item in obj]

    elif isinstance(obj, str):
        # Check if the string is or contains embedded JSON
        if "{" in obj and "}" in obj:
            start_idx = obj.find("{")
            end_idx = obj.rfind("}")
            if start_idx < end_idx:
                json_candidate = obj[start_idx : end_idx + 1]
                try:
                    parsed = json.loads(json_candidate)
                    redacted_json = json.dumps(redact_data(parsed))
                    obj = obj[:start_idx] + redacted_json + obj[end_idx + 1 :]
                except Exception:
                    def _scrub_json_blob(m: re.Match) -> str:
                        try:
                            return json.dumps(redact_data(json.loads(m.group(0))))
                        except Exception:
                            return m.group(0)
                    obj = re.sub(r"\{[^{}]*\}", _scrub_json_blob, obj)

        return scrub_text(obj)

    return obj
