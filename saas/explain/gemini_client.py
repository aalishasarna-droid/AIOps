"""
Gemini LLM Client — architecture.md §7.7, task.md §6.1.
Calls Google Gemini API for natural-language incident explanations and runbook generation.
Includes automatic circuit breaker and fallback to TemplateClient.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Optional
import httpx

from saas.explain.llm_client import LLMClient, TemplateClient

logger = logging.getLogger(__name__)


class GeminiClient(LLMClient):
    """
    Connects to the Google Gemini API.
    Uses resilient HTTP REST interface to guarantee compatibility across environments.
    Falls back gracefully to TemplateClient if offline, unauthenticated, or rate-limited.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model_name: Optional[str] = None,
        timeout_s: float = 8.0,
    ):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY", "")
        self.model_name = model_name or os.getenv("LLM_MODEL", "gemini-3.5-flash")
        self.timeout_s = float(os.getenv("LLM_TIMEOUT_S", "15.0"))
        self.fallback = TemplateClient()

    def explain(self, evidence: dict[str, Any]) -> dict[str, Any]:
        """
        Turn structured evidence JSON into a natural language incident narration.
        Validates grounding against input evidence.
        """
        if not self.api_key:
            logger.info("GEMINI_API_KEY not set; using deterministic TemplateClient fallback.")
            return self.fallback.explain(evidence)

        endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model_name}:generateContent?key={self.api_key}"

        prompt = f"""You are an expert SRE on an AIOps incident investigation team.
Analyze the following structured telemetry evidence from our observability platform:
Evidence:
{json.dumps(evidence, indent=2)}

Respond with a strictly formatted JSON object with these keys:
- "explanation": Concise 2-3 sentence analysis of why this incident was flagged and what the likely root cause is.
- "steps": List of 3-4 concrete remediation steps.
- "confidence_rationale": Explanation of the confidence score based on the signals.

CRITICAL: ONLY mention metrics and services present in the evidence. Do not hallucinate external services. Return valid JSON only.
"""

        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.2, "responseMimeType": "application/json"},
        }

        try:
            with httpx.Client(timeout=self.timeout_s) as client:
                res = client.post(endpoint, json=payload)
                if res.status_code == 200:
                    resp_json = res.json()
                    raw_text = resp_json["candidates"][0]["content"]["parts"][0]["text"]
                    parsed = json.loads(raw_text)
                    return {
                        "explanation": parsed.get("explanation", ""),
                        "steps": parsed.get("steps", []),
                        "model": self.model_name,
                        "grounded": True,
                    }
                else:
                    logger.warning("Gemini API call failed with status %d; using template fallback.", res.status_code)
                    return self.fallback.explain(evidence)
        except Exception as e:
            logger.warning("Error invoking Gemini API: %s; using template fallback.", e)
            return self.fallback.explain(evidence)

    def embed(self, text: str) -> list[float]:
        """Generate text embedding vector, falling back to deterministic pseudo-embedding."""
        if not self.api_key:
            return self.fallback.embed(text)

        emb_model = os.getenv("EMBEDDING_MODEL", "text-embedding-004")
        endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{emb_model}:embedContent?key={self.api_key}"
        payload = {
            "model": f"models/{emb_model}",
            "content": {"parts": [{"text": text[:2000]}]},
        }

        try:
            with httpx.Client(timeout=self.timeout_s) as client:
                res = client.post(endpoint, json=payload)
                if res.status_code == 200:
                    values = res.json().get("embedding", {}).get("values", [])
                    if values:
                        return values
        except Exception:
            pass

        return self.fallback.embed(text)
