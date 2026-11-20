"""
Syslog listener and log parser — task 1.3.
Receives log messages and checks for auth failures or error patterns.
"""

from __future__ import annotations

import logging
import re
from typing import Optional

logger = logging.getLogger(__name__)

AUTH_FAILURE_PATTERN = re.compile(
    r"(?i)(failed password|authentication failure|invalid user|auth failure|access denied|login failed)"
)


class LogParser:
    """Parses incoming log strings for security events and categories."""

    @staticmethod
    def parse_line(line: str) -> dict[str, str | bool]:
        """Classify a single log line."""
        is_auth_failure = bool(AUTH_FAILURE_PATTERN.search(line))

        category = "general"
        if is_auth_failure:
            category = "auth_failure"
        elif re.search(r"(?i)(error|exception|fatal|panic)", line):
            category = "error"
        elif re.search(r"(?i)(warn|warning)", line):
            category = "warning"

        return {
            "raw_text": line,
            "category": category,
            "is_auth_failure": is_auth_failure,
        }
