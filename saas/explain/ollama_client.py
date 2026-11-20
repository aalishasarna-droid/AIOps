"""
Ollama LLM Client — architecture.md §7.7, §116, task.md §6.23.
Connects to local Ollama runtime on host for air-gapped, zero-cloud inference.
Supports deepseek-r1:14b and gemma4:12b for incident reasoning and embeddings.
"""

from __future__ import annotations

import json
import logging
import os
import re
from typing import Any, Optional
import httpx

from saas.explain.llm_client import LLMClient, TemplateClient

logger = logging.getLogger(__name__)

EMBEDDING_DIM = int(os.getenv("EMBEDDING_DIM", "768"))


class OllamaClient(LLMClient):
    """
    Connects to local Ollama instance (default: http://host.docker.internal:11434).
    Enables fully local, privacy-preserving incident causal reasoning.
    """

    def __init__(
        self,
        base_url: Optional[str] = None,
        model_name: Optional[str] = None,
        timeout_s: float = 60.0,
    ):
        self.base_url = (base_url or os.getenv("OLLAMA_BASE_URL", "http://host.docker.internal:11434")).rstrip("/")
        self.model_name = model_name or os.getenv("OLLAMA_MODEL", "deepseek-r1:14b")
        self.timeout_s = timeout_s
        self.fallback = TemplateClient()

    def get_available_models(self) -> list[str]:
        """Query Ollama API for installed local models."""
        try:
            with httpx.Client(timeout=3.0) as client:
                res = client.get(f"{self.base_url}/api/tags")
                if res.status_code == 200:
                    models = res.json().get("models", [])
                    return [m.get("name") for m in models if m.get("name")]
        except Exception as e:
            logger.debug("Failed to list Ollama models: %s", e)
        return ["deepseek-r1:14b", "gemma4:12b"]

    def explain(self, evidence: dict[str, Any]) -> dict[str, Any]:
        """
        Turn structured evidence JSON into a natural language incident narration
        using local Ollama models (deepseek-r1:14b or gemma4:12b).
        """
        root = evidence.get("root_cause", {}).get("entity", "unknown")
        signals = evidence.get("contributing_signals", [])
        signals_summary = ", ".join([f"{s.get('signal')} (+{s.get('score')}σ on {s.get('service')})" for s in signals])

        prompt = f"""You are an expert SRE on an AIOps incident investigation team.
Analyze the following structured telemetry incident evidence:
Root Cause Candidate: {root}
Contributing Signals: {signals_summary}
Why Flagged: {evidence.get("why_flagged", "")}
Reasoning Path: {evidence.get("reasoning_path", [])}

Output ONLY a valid JSON object with EXACTLY this structure:
{{
  "explanation": "2-3 concise sentences explaining the failure propagation from {root} and root cause isolation.",
  "steps": [
    "Concrete remediation step 1 for {root}",
    "Remediation step 2",
    "Remediation step 3"
  ],
  "confidence_rationale": "High confidence based on elevated telemetry deviations on {root}"
}}
CRITICAL: Do not include markdown codeblocks or thinking tags in output. Return raw JSON only."""

        payload = {
            "model": self.model_name,
            "prompt": prompt,
            "stream": False,
            "format": "json",
            "options": {
                "temperature": 0.2,
                "num_predict": 512,
            },
        }

        try:
            with httpx.Client(timeout=self.timeout_s) as client:
                res = client.post(f"{self.base_url}/api/generate", json=payload)
                if res.status_code == 200:
                    raw_resp = res.json().get("response", "").strip()
                    # Strip DeepSeek-R1 <think>...</think> tags if present
                    cleaned = re.sub(r"<think>[\s\S]*?</think>", "", raw_resp).strip()
                    # Strip any markdown code fence wrappers
                    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", cleaned, flags=re.MULTILINE).strip()

                    parsed = json.loads(cleaned)
                    steps = parsed.get("steps") or evidence.get("recommended_steps", [])
                    explanation_text = parsed.get("explanation") or raw_resp

                    # Format formatted narration string matching dashboard requirements
                    narration_str = f"**Why flagged:** {evidence.get('why_flagged', '')}\n"
                    narration_str += f"**Contributing signals:** {signals_summary}\n"
                    narration_str += f"**Root cause candidate:** {root} (confidence {evidence.get('root_cause', {}).get('confidence', 0.85):.0%})\n"
                    narration_str += f"**Local Ollama Analysis ({self.model_name}):** {explanation_text}"

                    return {
                        "evidence": evidence,
                        "narration": narration_str,
                        "steps": steps,
                        "model": f"ollama/{self.model_name}",
                        "grounded": True,
                    }
                else:
                    logger.warning("Ollama API returned HTTP %d: %s", res.status_code, res.text)
        except Exception as e:
            logger.warning("Ollama call failed (%s); falling back to TemplateClient.", e)

        # Fallback to deterministic template client
        fb = self.fallback.explain(evidence)
        fb["model"] = f"ollama/{self.model_name} (fallback: template)"
        return fb

    def embed(self, text: str) -> list[float]:
        """Generate vector embedding using Ollama."""
        try:
            with httpx.Client(timeout=10.0) as client:
                res = client.post(
                    f"{self.base_url}/api/embeddings",
                    json={"model": self.model_name, "prompt": text},
                )
                if res.status_code == 200:
                    emb = res.json().get("embedding", [])
                    if len(emb) >= EMBEDDING_DIM:
                        return emb[:EMBEDDING_DIM]
                    # Pad to 768
                    return emb + [0.0] * (EMBEDDING_DIM - len(emb))
        except Exception as e:
            logger.debug("Ollama embedding fallback: %s", e)

        return self.fallback.embed(text)
