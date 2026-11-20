"""
Transport client — sends allow-listed payloads from Collector to SaaS Ingest API.
Ref: architecture.md §4, §5
"""

from __future__ import annotations

import logging
import os
from typing import Any, Optional
import httpx

logger = logging.getLogger(__name__)


class IngestSender:
    """HTTP client sending batches to the SaaS Ingest API."""

    def __init__(
        self,
        ingest_url: Optional[str] = None,
        api_key: Optional[str] = None,
        timeout_s: float = 5.0,
    ):
        self.ingest_url = (ingest_url or os.getenv("INGEST_URL", "http://ingest-api:8000")).rstrip("/")
        self.api_key = api_key or os.getenv("COLLECTOR_API_KEY", "")
        self.timeout_s = timeout_s

    def send_batch(self, payloads: list[dict[str, Any]]) -> dict[str, Any]:
        """
        POST a batch of allow-listed payloads to /ingest.
        Returns the receipt dict: {received: N, status: 'ok', receipts: [...]}
        """
        if not payloads:
            return {"received": 0, "status": "empty"}

        url = f"{self.ingest_url}/ingest"
        headers = {
            "Content-Type": "application/json",
            "X-Collector-Key": self.api_key,
        }

        body = {"payloads": payloads}

        with httpx.Client(timeout=self.timeout_s) as client:
            resp = client.post(url, json=body, headers=headers)
            resp.raise_for_status()
            return resp.json()
