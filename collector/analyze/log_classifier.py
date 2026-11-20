"""
Local LLM Log Classifier — architecture.md §116, task.md §6.23.
Uses local Ollama on the customer node to classify raw log lines into categories.
Only the CATEGORY and COUNT leave the trust boundary. Raw log lines stay local.

HARD RULE (AGENTS.md):
Never import cloud LLM clients (Gemini, OpenAI, etc.) in /collector.
This module only communicates with local Ollama on localhost/host.docker.internal.
"""

from __future__ import annotations

import json
import logging
import os
import re
from typing import Any, Optional
import httpx

logger = logging.getLogger(__name__)

ALLOWLISTED_CATEGORIES = [
    "db_error",
    "oom",
    "timeout",
    "auth_fail",
    "disk_full",
    "network_drop",
    "normal",
]


class LocalOllamaLogClassifier:
    """
    Classifies raw customer log lines using a local Ollama model.
    Outputs ONLY aggregated category counts to preserve 100% data privacy.
    """

    def __init__(
        self,
        base_url: Optional[str] = None,
        model_name: Optional[str] = None,
        timeout_s: float = 10.0,
    ):
        self.base_url = (base_url or os.getenv("OLLAMA_BASE_URL", "http://host.docker.internal:11434")).rstrip("/")
        self.model_name = model_name or os.getenv("LOCAL_LLM_MODEL", "deepseek-r1:14b")
        self.timeout_s = timeout_s

    def classify_log_line(self, raw_log: str) -> str:
        """
        Classify a single raw log line into an allow-listed category.
        Falls back to fast deterministic regex matching if Ollama is offline.
        """
        prompt = f"""Classify the following server log line into exactly ONE of these categories:
{json.dumps(ALLOWLISTED_CATEGORIES)}

Log: "{raw_log}"

Respond with ONLY the exact category name in quotes, nothing else."""

        try:
            with httpx.Client(timeout=self.timeout_s) as client:
                res = client.post(
                    f"{self.base_url}/api/generate",
                    json={
                        "model": self.model_name,
                        "prompt": prompt,
                        "stream": False,
                        "options": {"temperature": 0.0, "num_predict": 16},
                    },
                )
                if res.status_code == 200:
                    out = res.json().get("response", "").strip().lower().strip('"\'')
                    # Strip any DeepSeek-R1 thinking tags
                    out = re.sub(r"<think>[\s\S]*?</think>", "", out).strip()
                    for cat in ALLOWLISTED_CATEGORIES:
                        if cat in out:
                            return cat
        except Exception as e:
            logger.debug("Ollama local classification offline (%s); using deterministic heuristic", e)

        # Fallback heuristic (local regex)
        lowered = raw_log.lower()
        if "password" in lowered or "failed login" in lowered or "auth" in lowered or "unauthorized" in lowered:
            return "auth_fail"
        if "postgres" in lowered or "connection pool" in lowered or "deadlock" in lowered or "database" in lowered:
            return "db_error"
        if "oom" in lowered or "out of memory" in lowered or "heap" in lowered:
            return "oom"
        if "timeout" in lowered or "timed out" in lowered or "504" in lowered:
            return "timeout"
        if "disk" in lowered or "no space left" in lowered:
            return "disk_full"
        return "normal"

    def aggregate_batch(self, raw_logs: list[str]) -> dict[str, int]:
        """
        Process a batch of raw logs and return only category counts.
        CRITICAL: Raw log text is discarded immediately after classification.
        """
        counts: dict[str, int] = {cat: 0 for cat in ALLOWLISTED_CATEGORIES}
        for line in raw_logs:
            cat = self.classify_log_line(line)
            counts[cat] = counts.get(cat, 0) + 1

        # Return only non-zero categories
        return {k: v for k, v in counts.items() if v > 0}
