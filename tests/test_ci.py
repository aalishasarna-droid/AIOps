"""
CI & Architecture Boundary Checks — tasks 0.15 and 0.21.

Enforces:
1. Hard boundary: /collector/** NEVER imports cloud LLM clients (Gemini, OpenAI, anthropic, or saas.explain.llm_client).
2. Volume boundary: Only the collector service mounts `collector_raw`; no SaaS service mounts it.
3. No secrets in tracked source code.
"""

import ast
import os
import re
from pathlib import Path
import pytest
import yaml

REPO_ROOT = Path(__file__).resolve().parent.parent


def test_collector_does_not_import_cloud_llm():
    """Fail if /collector imports cloud LLM libraries or SaaS LLM client."""
    forbidden_modules = {
        "google.generativeai",
        "google.genai",
        "openai",
        "anthropic",
        "langchain",
        "saas.explain.llm_client",
        "saas.explain",
    }

    collector_dir = REPO_ROOT / "collector"
    violations = []

    for py_file in collector_dir.rglob("*.py"):
        try:
            tree = ast.parse(py_file.read_text(encoding="utf-8"), filename=str(py_file))
        except SyntaxError:
            continue

        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    for forbidden in forbidden_modules:
                        if alias.name == forbidden or alias.name.startswith(forbidden + "."):
                            violations.append((str(py_file.relative_to(REPO_ROOT)), alias.name))
            elif isinstance(node, ast.ImportFrom):
                if node.module:
                    for forbidden in forbidden_modules:
                        if node.module == forbidden or node.module.startswith(forbidden + "."):
                            violations.append((str(py_file.relative_to(REPO_ROOT)), node.module))

    assert not violations, f"Collector violates boundary by importing cloud LLM: {violations}"


def test_collector_raw_volume_isolation():
    """Verify docker-compose.yml mounts collector_raw ONLY in collector."""
    compose_path = REPO_ROOT / "docker-compose.yml"
    assert compose_path.exists(), "docker-compose.yml missing"

    with open(compose_path, "r", encoding="utf-8") as f:
        compose = yaml.safe_load(f)

    services = compose.get("services", {})
    mounting_services = []

    for svc_name, svc_conf in services.items():
        volumes = svc_conf.get("volumes", [])
        for vol in volumes:
            vol_str = vol if isinstance(vol, str) else vol.get("source", "")
            if "collector_raw" in vol_str:
                mounting_services.append(svc_name)

    assert mounting_services == ["collector"], (
        f"Only 'collector' may mount 'collector_raw'. Found in: {mounting_services}"
    )


def test_no_hardcoded_secrets_in_repo():
    """Check that typical secret patterns are not hardcoded in repo source files."""
    secret_patterns = [
        re.compile(r"AKIA[0-9A-Z]{16}"),  # AWS Access Key
        re.compile(r"AIza[0-9A-Za-z\\-_]{35}"),  # Google API Key
        re.compile(r"sk-[a-zA-Z0-9]{32,}"),  # OpenAI-style key
    ]

    scanned_extensions = {".py", ".yaml", ".yml", ".json", ".sql", ".sh"}
    violations = []

    for path in REPO_ROOT.rglob("*"):
        if path.is_file() and path.suffix in scanned_extensions:
            # Skip documentation examples, simulator definitions with canaries, or test files
            rel = str(path.relative_to(REPO_ROOT))
            if any(skip in rel for skip in ["docs/", "simulator/", "tests/", ".git/"]):
                continue

            content = path.read_text(encoding="utf-8", errors="ignore")
            for pattern in secret_patterns:
                if pattern.search(content):
                    violations.append((rel, pattern.pattern))

    assert not violations, f"Potential hardcoded secrets detected: {violations}"
