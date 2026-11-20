"""
Pseudonymization using per-tenant keyed HMAC.
Ref: architecture.md §3, task.md §1.9
"""

from __future__ import annotations

import hmac
import hashlib
import os

DEFAULT_TENANT_SECRET = os.getenv("TENANT_SECRET", "local-tenant-default-secret-salt-2026")


def pseudonymize_source_id(source_id: str, tenant_secret: str = "") -> str:
    """
    Produce a deterministic, irreversible pseudonym for a source/host name
    using HMAC-SHA256 with the tenant's local secret.

    Returns:
        A formatted string like 'src_8f9a2b1c4e5d6f70' (16 hex chars)
    """
    secret = (tenant_secret or os.getenv("TENANT_SECRET") or DEFAULT_TENANT_SECRET).encode("utf-8")
    raw_bytes = source_id.encode("utf-8")
    mac = hmac.new(secret, raw_bytes, hashlib.sha256).hexdigest()
    # Truncate to 16 hex characters for readability while maintaining 64 bits of entropy
    return f"src_{mac[:16]}"
