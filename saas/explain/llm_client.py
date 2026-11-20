"""
LLMClient abstraction — architecture.md §7.7

Implementations:
  - TemplateClient  (deterministic fallback, no network — always available)
  - GeminiClient    (Phase 6, behind circuit breaker)

The SaaS side ONLY. The collector must NEVER import this module.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
from abc import ABC, abstractmethod
from typing import Optional

logger = logging.getLogger(__name__)

EMBEDDING_DIM = int(os.getenv("EMBEDDING_DIM", "768"))


class LLMClient(ABC):
    """
    Protocol for all LLM interactions on the SaaS side.
    Every implementation must return validated JSON.
    """

    @abstractmethod
    def explain(self, evidence: dict) -> dict:
        """
        Turn structured evidence into a human-readable explanation.

        Returns:
            {
                "explanation": str,
                "steps": list[str],
                "model": str,
                "grounded": bool,
            }
        """
        ...

    @abstractmethod
    def embed(self, text: str) -> list[float]:
        """Return an embedding vector of EMBEDDING_DIM (768) floats."""
        ...


class TemplateClient(LLMClient):
    """
    Deterministic explanation from evidence JSON — no network, no API key.
    This is the always-on fallback and the default until Phase 6 delivers
    the GeminiClient.
    """

    def explain(self, evidence: dict) -> dict:
        # Build a template explanation from the evidence fields
        why = evidence.get("why_flagged", "Anomaly detected")
        signals = evidence.get("contributing_signals", [])
        root = evidence.get("root_cause", {})
        alternatives = evidence.get("alternatives", [])

        signal_lines = []
        for sig in signals:
            name = sig.get("signal", "unknown")
            score = sig.get("score", 0)
            direction = sig.get("direction", "")
            signal_lines.append(f"  • {name}: score {score:.2f} ({direction})")

        explanation_parts = [f"**Why flagged:** {why}"]
        if signal_lines:
            explanation_parts.append("**Contributing signals:**")
            explanation_parts.extend(signal_lines)
        if root:
            entity = root.get("entity", "unknown")
            confidence = root.get("confidence", 0)
            explanation_parts.append(
                f"**Root cause candidate:** {entity} (confidence {confidence:.0%})"
            )
        if alternatives:
            alt_strs = [
                f"{a.get('entity', '?')} ({a.get('confidence', 0):.0%})"
                for a in alternatives
            ]
            explanation_parts.append(f"**Alternatives:** {', '.join(alt_strs)}")

        steps = evidence.get("recommended_steps", [
            "Investigate the root cause entity",
            "Check related metrics and logs",
            "Review recent deployments or changes",
        ])

        return {
            "explanation": "\n".join(explanation_parts),
            "steps": steps,
            "model": "template-1.0",
            "grounded": True,  # template is deterministic, always grounded
        }

    def embed(self, text: str) -> list[float]:
        """
        Deterministic pseudo-embedding: SHA-256 hash expanded to EMBEDDING_DIM.
        NOT a real semantic embedding — only for testing / fallback.
        """
        h = hashlib.sha256(text.encode()).digest()
        # Repeat hash bytes to fill EMBEDDING_DIM floats, normalize to [-1, 1]
        values: list[float] = []
        for i in range(EMBEDDING_DIM):
            byte_val = h[i % len(h)]
            values.append((byte_val / 127.5) - 1.0)
        return values


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------

_PROVIDER_MAP: dict[str, type[LLMClient]] = {
    "template": TemplateClient,
    # "gemini": GeminiClient,  # registered in Phase 6
}


def get_llm_client(provider: Optional[str] = None) -> LLMClient:
    """
    Return the configured LLMClient.
    Falls back to TemplateClient if the requested provider is unavailable.
    """
    provider = provider or os.getenv("LLM_PROVIDER", "template")
    cls = _PROVIDER_MAP.get(provider)
    if cls is None:
        logger.warning(
            "LLM provider '%s' not registered; falling back to TemplateClient",
            provider,
        )
        cls = TemplateClient
    return cls()


def register_provider(name: str, cls: type[LLMClient]) -> None:
    """Register a new LLMClient implementation (e.g. GeminiClient in Phase 6)."""
    _PROVIDER_MAP[name] = cls
