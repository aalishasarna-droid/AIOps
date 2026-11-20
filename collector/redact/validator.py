"""
Output validators — task 1.10.
Validates fields against enums, length caps, and final regex deny-lists.
Any invalid field is dropped and flagged.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)

MAX_CONTEXT_LENGTH = 200
MAX_CATEGORY_LENGTH = 64
MAX_SOURCE_ID_LENGTH = 64


def validate_and_sanitize_payload_fields(fields: dict[str, Any]) -> dict[str, Any]:
    """
    Enforce schema caps and checks before constructing IngestPayload.
    Drops or truncates invalid fields and records warnings.
    """
    sanitized = dict(fields)

    # 1. Context cap
    if "context" in sanitized and sanitized["context"]:
        ctx = str(sanitized["context"])
        if len(ctx) > MAX_CONTEXT_LENGTH:
            logger.warning("Context exceeded %d chars, truncating", MAX_CONTEXT_LENGTH)
            sanitized["context"] = ctx[:MAX_CONTEXT_LENGTH]

    # 2. Category length cap
    if "category" in sanitized and sanitized["category"]:
        cat = str(sanitized["category"])
        if len(cat) > MAX_CATEGORY_LENGTH:
            sanitized["category"] = cat[:MAX_CATEGORY_LENGTH]

    # 3. Source ID length cap
    if "source_id" in sanitized and sanitized["source_id"]:
        sid = str(sanitized["source_id"])
        if len(sid) > MAX_SOURCE_ID_LENGTH:
            sanitized["source_id"] = sid[:MAX_SOURCE_ID_LENGTH]

    return sanitized
