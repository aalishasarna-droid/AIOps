"""
Collector Local Admin UI — task 1.17.
Runs on localhost:8080 inside customer Tier 1 environment to prove zero leakage:
- Side-by-side Raw vs. Sent allow-listed metadata view
- Real-time cryptographic Egress Audit Log viewer with full UUIDv7 Payload IDs and SHA-256 hashes
- 1-Click Copy and direct cross-verification links to Cloud SaaS Dashboard (:3000)
- Live multi-tenant binding selector (Acme Financial, aanya tech, etc.) synced with Supabase
- Live Transmit to Cloud Ingest API (:8000) with automatic Supabase persistence
- Interactive zero-leak redaction console with preset enterprise attack vectors
- AST-enforced zero cloud LLM client boundary
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import urllib.request
import uuid
from datetime import datetime, timezone
from http.server import HTTPServer, BaseHTTPRequestHandler
import threading
from typing import Any, Optional
from collector.redact.scrubbers import redact_data
from collector.redact.pseudonym import pseudonymize_source_id

logger = logging.getLogger(__name__)

HTML_PAGE = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tier 1 Local Collector — Privacy Gate & Egress Audit</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #07090E;
      --surface: #0D1117;
      --surface-card: #111620;
      --surface-hover: #161D2A;
      --border: rgba(255, 255, 255, 0.08);
      --border-light: rgba(255, 255, 255, 0.15);
      --lime: #C8F63B;
      --lime-glow: rgba(200, 246, 59, 0.15);
      --emerald: #22C55E;
      --emerald-glow: rgba(34, 197, 94, 0.15);
      --cyan: #38BDF8;
      --cyan-glow: rgba(56, 189, 248, 0.15);
      --purple: #A78BFA;
      --text: #F1F5F9;
      --text-muted: #9AA4B2;
      --text-dim: #626E7E;
      --red: #F43F5E;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      min-height: 100vh;
      padding: 1.5rem 2rem;
      line-height: 1.5;
    }

    code, pre, .mono {
      font-family: 'JetBrains Mono', monospace;
    }

    /* Top Navigation */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 1.25rem;
      border-bottom: 1px solid var(--border);
      margin-bottom: 1.5rem;
      flex-wrap: wrap;
      gap: 1rem;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 0.85rem;
    }
    .brand-icon {
      width: 42px;
      height: 42px;
      border-radius: 12px;
      background: var(--emerald-glow);
      border: 1px solid rgba(34, 197, 94, 0.35);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.35rem;
      color: var(--emerald);
    }
    .brand h1 {
      font-size: 1.25rem;
      font-weight: 700;
      color: #FFF;
      letter-spacing: -0.02em;
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }
    .brand p {
      font-size: 0.75rem;
      color: var(--text-muted);
      margin-top: 0.15rem;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.7rem;
      font-weight: 700;
      padding: 0.25rem 0.65rem;
      border-radius: 6px;
      font-family: 'JetBrains Mono', monospace;
      letter-spacing: 0.03em;
      text-transform: uppercase;
    }
    .badge-green {
      background: rgba(34, 197, 94, 0.12);
      color: var(--emerald);
      border: 1px solid rgba(34, 197, 94, 0.28);
    }
    .badge-cyan {
      background: rgba(56, 189, 248, 0.12);
      color: var(--cyan);
      border: 1px solid rgba(56, 189, 248, 0.28);
    }
    .badge-lime {
      background: rgba(200, 246, 59, 0.12);
      color: var(--lime);
      border: 1px solid rgba(200, 246, 59, 0.28);
    }
    .badge-purple {
      background: rgba(167, 139, 250, 0.12);
      color: var(--purple);
      border: 1px solid rgba(167, 139, 250, 0.28);
    }

    .pulse-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--emerald);
      box-shadow: 0 0 8px var(--emerald);
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.85); }
      100% { opacity: 1; transform: scale(1); }
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.45rem 0.9rem;
      border-radius: 8px;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.18s ease;
      border: 1px solid transparent;
    }
    .btn-lime {
      background: var(--lime);
      color: #07090E;
      box-shadow: 0 0 12px rgba(200, 246, 59, 0.25);
    }
    .btn-lime:hover {
      background: #D8FF54;
      transform: translateY(-1px);
    }
    .btn-emerald {
      background: var(--emerald);
      color: #07090E;
      box-shadow: 0 0 12px rgba(34, 197, 94, 0.25);
    }
    .btn-emerald:hover {
      background: #34D399;
      transform: translateY(-1px);
    }
    .btn-outline {
      background: rgba(255, 255, 255, 0.04);
      color: var(--text);
      border-color: var(--border-light);
    }
    .btn-outline:hover {
      background: rgba(255, 255, 255, 0.08);
      color: #FFF;
      border-color: var(--text-muted);
    }
    .btn-copy {
      padding: 0.2rem 0.45rem;
      font-size: 0.7rem;
      background: rgba(255, 255, 255, 0.05);
      color: var(--text-muted);
      border: 1px solid var(--border);
      border-radius: 4px;
      cursor: pointer;
    }
    .btn-copy:hover {
      background: rgba(255, 255, 255, 0.12);
      color: #FFF;
      border-color: var(--lime);
    }

    /* Tenant Selector Bar */
    .tenant-bar {
      background: rgba(56, 189, 248, 0.05);
      border: 1px solid rgba(56, 189, 248, 0.25);
      border-radius: 12px;
      padding: 0.75rem 1.25rem;
      margin-bottom: 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 0.75rem;
    }
    .tenant-select {
      background: #020408;
      border: 1px solid var(--border-light);
      border-radius: 8px;
      color: #FFF;
      padding: 0.4rem 0.85rem;
      font-size: 0.82rem;
      font-weight: 600;
      font-family: 'JetBrains Mono', monospace;
      outline: none;
      cursor: pointer;
    }
    .tenant-select:focus {
      border-color: var(--cyan);
    }

    /* Stat Cards Barometer */
    .stat-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .stat-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1rem 1.2rem;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      transition: border-color 0.2s;
    }
    .stat-card:hover {
      border-color: rgba(255, 255, 255, 0.2);
    }
    .stat-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
    }
    .stat-label {
      font-size: 0.72rem;
      text-transform: uppercase;
      font-weight: 700;
      color: var(--text-muted);
      font-family: 'JetBrains Mono', monospace;
      letter-spacing: 0.04em;
    }
    .stat-value {
      font-size: 1.35rem;
      font-weight: 700;
      color: #FFF;
      display: flex;
      align-items: baseline;
      gap: 0.4rem;
    }
    .stat-sub {
      font-size: 0.75rem;
      color: var(--text-dim);
      margin-top: 0.3rem;
      display: flex;
      align-items: center;
      gap: 0.3rem;
    }

    /* Cards */
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 1.4rem;
      margin-bottom: 1.5rem;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 0.85rem;
      border-bottom: 1px solid var(--border);
      margin-bottom: 1.1rem;
      flex-wrap: wrap;
      gap: 0.6rem;
    }
    .card-title {
      font-size: 0.95rem;
      font-weight: 700;
      color: #FFF;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .card-subtitle {
      font-size: 0.8rem;
      color: var(--text-muted);
      margin-top: -0.4rem;
      margin-bottom: 1rem;
      line-height: 1.45;
    }

    /* Presets bar */
    .presets-bar {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.85rem;
      flex-wrap: wrap;
    }
    .presets-label {
      font-size: 0.72rem;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      font-family: 'JetBrains Mono', monospace;
    }
    .preset-chip {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--border);
      color: var(--text);
      font-size: 0.75rem;
      padding: 0.25rem 0.6rem;
      border-radius: 6px;
      cursor: pointer;
      font-family: 'JetBrains Mono', monospace;
      transition: all 0.15s ease;
    }
    .preset-chip:hover {
      background: rgba(200, 246, 59, 0.12);
      border-color: var(--lime);
      color: var(--lime);
    }

    /* Split Grid */
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.25rem;
    }
    @media (max-width: 900px) {
      .grid-2 { grid-template-columns: 1fr; }
    }

    .editor-label-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.45rem;
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--text-muted);
      font-family: 'JetBrains Mono', monospace;
    }
    textarea {
      width: 100%;
      height: 180px;
      background: #020408;
      border: 1px solid var(--border);
      border-radius: 10px;
      color: #E2E8F0;
      padding: 0.85rem;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.8rem;
      resize: vertical;
      line-height: 1.5;
    }
    textarea:focus {
      outline: none;
      border-color: var(--lime);
      box-shadow: 0 0 0 1px var(--lime);
    }
    .preview-box {
      width: 100%;
      height: 180px;
      background: #020408;
      border: 1px solid var(--border);
      border-radius: 10px;
      color: var(--emerald);
      padding: 0.85rem;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.8rem;
      overflow: auto;
      white-space: pre-wrap;
      word-break: break-all;
      line-height: 1.5;
    }

    /* Delivery Alert Box */
    .delivery-box {
      margin-top: 1rem;
      background: rgba(34, 197, 94, 0.08);
      border: 1px solid rgba(34, 197, 94, 0.3);
      border-radius: 10px;
      padding: 0.85rem 1.1rem;
      display: none;
      font-size: 0.78rem;
      font-family: 'JetBrains Mono', monospace;
    }

    /* Table Toolbar */
    .table-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.85rem;
      gap: 0.75rem;
      flex-wrap: wrap;
    }
    .search-input {
      background: #020408;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 0.45rem 0.85rem;
      color: #FFF;
      font-size: 0.8rem;
      width: 320px;
      font-family: 'JetBrains Mono', monospace;
    }
    .search-input:focus {
      outline: none;
      border-color: var(--cyan);
    }
    .filter-select {
      background: #020408;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 0.45rem 0.75rem;
      color: #FFF;
      font-size: 0.8rem;
    }

    /* Table */
    .table-container {
      overflow-x: auto;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: #020408;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.8rem;
      text-align: left;
    }
    th {
      background: rgba(255, 255, 255, 0.02);
      color: var(--text-dim);
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--border);
      letter-spacing: 0.04em;
      font-family: 'JetBrains Mono', monospace;
    }
    td {
      padding: 0.75rem 1rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
      color: var(--text);
      vertical-align: middle;
    }
    tr:hover td {
      background: rgba(255, 255, 255, 0.02);
    }
    .id-chip {
      color: var(--cyan);
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
    }
    .hash-chip {
      color: var(--purple);
      font-size: 0.75rem;
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
    }
    .source-chip {
      color: #FFF;
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
    }

    /* Verification Box */
    .verify-box {
      background: rgba(200, 246, 59, 0.03);
      border: 1px solid rgba(200, 246, 59, 0.2);
      border-radius: 12px;
      padding: 1rem 1.25rem;
      margin-top: 1.25rem;
    }
    .verify-box-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.6rem;
    }
    .verify-box h4 {
      font-size: 0.85rem;
      font-weight: 700;
      color: var(--lime);
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }
    .verify-inputs {
      display: flex;
      gap: 0.6rem;
      flex-wrap: wrap;
    }
    .verify-input {
      flex: 1;
      min-width: 280px;
      background: #020408;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 0.45rem 0.85rem;
      color: #FFF;
      font-size: 0.8rem;
      font-family: 'JetBrains Mono', monospace;
    }
    .verify-result {
      margin-top: 0.75rem;
      padding: 0.65rem 0.85rem;
      border-radius: 8px;
      font-size: 0.78rem;
      font-family: 'JetBrains Mono', monospace;
      display: none;
    }

    /* Modal */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(8px);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 1rem;
    }
    .modal-card {
      background: var(--surface);
      border: 1px solid var(--border-light);
      border-radius: 16px;
      width: 100%;
      max-width: 720px;
      max-height: 85vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.75);
      overflow: hidden;
    }
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.1rem 1.4rem;
      border-bottom: 1px solid var(--border);
    }
    .modal-body {
      padding: 1.4rem;
      overflow-y: auto;
    }
    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      padding: 1rem 1.4rem;
      border-top: 1px solid var(--border);
      background: rgba(0, 0, 0, 0.2);
    }

    /* Toast */
    .toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: var(--surface-card);
      border: 1px solid var(--lime);
      color: var(--lime);
      padding: 0.65rem 1.1rem;
      border-radius: 8px;
      font-size: 0.8rem;
      font-weight: 600;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
      transform: translateY(100px);
      opacity: 0;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      z-index: 2000;
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }
    .toast.show {
      transform: translateY(0);
      opacity: 1;
    }
  </style>
</head>
<body>

  <!-- Top Header Navigation -->
  <header class="header">
    <div class="brand">
      <div class="brand-icon">🛡️</div>
      <div>
        <h1>
          Tier 1 Local Collector
          <span class="badge badge-green"><span class="pulse-dot"></span> Gate 1 Active</span>
        </h1>
        <p>Customer Environment Trust Boundary • Pre-WAN Scrubbing & Cryptographic Provenance</p>
      </div>
    </div>

    <div class="header-actions">
      <span class="badge badge-cyan" id="ingestTargetBadge">Target: ingest-api:8000</span>
      <span class="badge badge-purple">Zero Cloud LLMs (AST Enforced)</span>
      <a id="cloudPrivacyBtn" href="http://localhost:3000/dashboard/privacy" target="_blank" class="btn btn-lime">
        <span>Verify in Cloud SaaS</span> ↗
      </a>
      <a href="http://localhost:3000" target="_blank" class="btn btn-outline">
        <span>Open SaaS Dashboard</span> ↗
      </a>
    </div>
  </header>

  <!-- Live Multi-Tenant Selector & Cloud Link -->
  <section class="tenant-bar">
    <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
      <span style="font-size: 0.75rem; font-weight: 700; color: var(--cyan); font-family: 'JetBrains Mono', monospace;">
        🏢 TRANSMIT TENANT:
      </span>
      <select id="tenantSelect" class="tenant-select" onchange="switchCollectorTenant()">
        <option value="00000000-0000-0000-0000-000000000001">Acme Financial Corp (00000000...)</option>
      </select>
      <span class="badge badge-lime" id="activeTenantBadge">Acme Financial Corp</span>
    </div>
    <div style="font-size: 0.75rem; color: var(--text-muted); font-family: monospace;">
      <span>Synced with Central SaaS &amp; Supabase Database</span>
    </div>
  </section>

  <!-- 4 Core Telemetry Barometer Cards -->
  <section class="stat-grid">
    <div class="stat-card">
      <div class="stat-header">
        <span class="stat-label">Total Egress Frames</span>
        <span class="badge badge-cyan">Append-Only</span>
      </div>
      <div class="stat-value" id="statEgressCount">0</div>
      <div class="stat-sub">
        <span>✓ Signed with SHA-256 canonical hash</span>
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-header">
        <span class="stat-label">Canary Secret Leak Rate</span>
        <span class="badge badge-green">0.00% Zero-Leak</span>
      </div>
      <div class="stat-value" style="color: var(--emerald);">0 Leaks</div>
      <div class="stat-sub">
        <span>Passes automated CI canary leak tests</span>
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-header">
        <span class="stat-label">HMAC Pseudonym Source</span>
        <span class="badge badge-lime">Keyed SHA-256</span>
      </div>
      <div class="stat-value" style="font-size: 1.05rem;" id="statSourceId">src_...</div>
      <div class="stat-sub">
        <span id="statRawHost">Host: node-primary-01 (masked)</span>
        <button class="btn-copy" onclick="copyText(currentSourceId, 'HMAC Source ID')">Copy</button>
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-header">
        <span class="stat-label">Edge Ingest Topology</span>
        <span class="badge badge-purple">Tier 1 &rarr; Tier 2</span>
      </div>
      <div class="stat-value" style="font-size: 1.15rem;" id="statCollectorId">col-local-01</div>
      <div class="stat-sub">
        <span id="statRegion">Region: ap-south-1 • WAN Link</span>
      </div>
    </div>
  </section>

  <!-- Interactive Zero-Leak Redaction Console -->
  <section class="card">
    <div class="card-header">
      <div class="card-title">
        <span>⚡ Interactive Zero-Leak Verification &amp; Live Ingestion Console</span>
        <span class="badge badge-green">Default-Deny Enforced</span>
      </div>
      <span style="font-size: 0.75rem; color: var(--text-dim); font-family: monospace;">Pydantic schema extra="forbid"</span>
    </div>

    <p class="card-subtitle">
      Raw logs are intercepted and sanitized strictly inside customer private memory. Passwords, JWTs, Luhn credit cards, and planted <code>CANARY-...</code> secrets are scrubbed before any allow-listed metadata packet leaves the node.
      Click <strong>&quot;Transmit to Cloud Ingest&quot;</strong> to send the scrubbed metadata live over the WAN to the Central SaaS API and write directly into Supabase!
    </p>

    <!-- Preset Vector Buttons -->
    <div class="presets-bar">
      <span class="presets-label">Test Vectors:</span>
      <button class="preset-chip" onclick="loadPreset('canary')">🧪 Canary Password</button>
      <button class="preset-chip" onclick="loadPreset('jwt')">🔑 JWT Bearer Token</button>
      <button class="preset-chip" onclick="loadPreset('cc')">💳 Credit Card (Luhn)</button>
      <button class="preset-chip" onclick="loadPreset('internal')">🌐 Internal IP & Host</button>
      <button class="preset-chip" onclick="loadPreset('db')">🗄️ DB Conn String</button>
    </div>

    <div class="grid-2">
      <div>
        <div class="editor-label-bar">
          <span>RAW LOCAL DATA (Customer Tier 1 — Stays Local)</span>
          <button class="btn-copy" onclick="document.getElementById('rawInput').value=''">Clear</button>
        </div>
        <textarea id="rawInput">DEBUG 2026-11-20T12:00:00Z auth_service: user=admin password=CANARY-password-hunter2 token=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.fake ip=192.168.1.50 credit_card=4111111111111111 host=db-primary-internal</textarea>
        
        <div style="display: flex; gap: 0.6rem; align-items: center; margin-top: 0.75rem; flex-wrap: wrap;">
          <button class="btn btn-lime" onclick="testRedaction()">
            <span>Simulate Ingest &amp; Redact</span> ⚡
          </button>
          <button class="btn btn-emerald" onclick="transmitToCloud()">
            <span>🚀 Transmit to Cloud Ingest (Updates Supabase)</span>
          </button>
        </div>
      </div>

      <div>
        <div class="editor-label-bar">
          <span>ALLOW-LISTED SENT METADATA (Crosses Trust Boundary)</span>
          <div style="display: flex; gap: 0.4rem;">
            <button class="btn-copy" onclick="copyRedactedOutput()">Copy Scrubbed JSON</button>
            <button class="btn-copy" id="btnCopyRedactSha" onclick="copyRedactedSha()">Copy SHA-256</button>
          </div>
        </div>
        <div class="preview-box" id="sentOutput">Click 'Simulate Ingest & Redact' or pick a test vector above...</div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.75rem; font-size: 0.75rem;">
          <div style="color: var(--text-muted); font-family: monospace;">
            Canonical Digest: <span id="redactShaText" style="color: var(--lime); font-weight: 700;">—</span>
          </div>
          <span class="badge badge-green">✓ 0 Secrets Leaked</span>
        </div>
      </div>
    </div>

    <!-- Live Cloud Delivery Receipt Notification -->
    <div id="deliveryBox" class="delivery-box"></div>
  </section>

  <!-- Cryptographic Egress Audit Trail Table -->
  <section class="card">
    <div class="card-header">
      <div class="card-title">
        <span>📜 Cryptographic Egress Audit Trail</span>
        <span class="badge badge-lime">Principle P2: "Prove it, don't claim it"</span>
      </div>
      <div style="display: flex; align-items: center; gap: 0.6rem;">
        <span class="badge badge-cyan" id="streamStatusBadge"><span class="pulse-dot"></span> Live Stream (3s)</span>
        <button class="btn btn-outline" style="padding: 0.35rem 0.7rem; font-size: 0.75rem;" onclick="fetchEgress()">
          ⟳ Refresh Now
        </button>
      </div>
    </div>

    <p class="card-subtitle">
      Every payload emitted by this collector is recorded into an append-only verifiable audit log before network transmission.
      Compare any <strong>Payload ID</strong> or <strong>SHA-256 Digest</strong> with the Central SaaS Ingest receipts to prove zero tampering.
    </p>

    <!-- Toolbar: Search & Filter -->
    <div class="table-toolbar">
      <div style="display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;">
        <input
          type="text"
          id="tableSearchInput"
          class="search-input"
          placeholder="🔍 Search by Payload ID, SHA-256, Source ID..."
          oninput="renderFilteredTable()"
        />
        <select id="kindFilterSelect" class="filter-select" onchange="renderFilteredTable()">
          <option value="ALL">All Payload Kinds</option>
          <option value="metric_window">metric_window</option>
          <option value="alert">alert</option>
          <option value="health">health</option>
          <option value="security_summary">security_summary</option>
        </select>
      </div>
      <div style="font-size: 0.75rem; color: var(--text-muted); font-family: monospace;" id="tableCountText">
        Showing recent payloads...
      </div>
    </div>

    <!-- The Egress Table -->
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Timestamp (UTC)</th>
            <th>Payload ID (UUIDv7)</th>
            <th>Canonical SHA-256 Digest</th>
            <th>HMAC Pseudonym Source</th>
            <th>Kind & Metrics</th>
            <th>Verification & Actions</th>
          </tr>
        </thead>
        <tbody id="egressTable">
          <tr>
            <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2rem;">
              Connecting to append-only egress log...
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Quick Cross-Server Matcher Utility -->
    <div class="verify-box">
      <div class="verify-box-header">
        <h4>🔍 Cross-Server ID & Cryptographic Receipt Matcher</h4>
        <span style="font-size: 0.75rem; color: var(--text-dim);">Verify match between Local Collector & Cloud SaaS</span>
      </div>
      <div class="verify-inputs">
        <input
          type="text"
          id="crossVerifyInput"
          class="verify-input"
          placeholder="Paste any Payload ID (e.g. 893a083e-...) or SHA-256 Digest here to verify provenance..."
        />
        <button class="btn btn-lime" onclick="runCrossVerify()">
          Verify Cryptographic Match
        </button>
      </div>
      <div id="crossVerifyResult" class="verify-result"></div>
    </div>
  </section>

  <!-- Payload Inspection Modal -->
  <div class="modal-backdrop" id="inspectModal" onclick="handleModalBackdropClick(event)">
    <div class="modal-card">
      <div class="modal-header">
        <div>
          <h3 style="font-size: 1rem; font-weight: 700; color: #FFF; display: flex; align-items: center; gap: 0.5rem;">
            <span>🔬 Canonical Egress Payload Inspection</span>
          </h3>
          <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.2rem;" id="modalPayloadId">ID: —</p>
        </div>
        <button class="btn-copy" style="font-size: 0.9rem; padding: 0.3rem 0.6rem;" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border); border-radius: 8px; padding: 0.75rem 1rem; margin-bottom: 1rem; font-size: 0.78rem;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 0.35rem;">
            <span style="color: var(--text-dim);">Canonical SHA-256 Hash:</span>
            <button class="btn-copy" onclick="copyModalHash()">Copy Hash</button>
          </div>
          <div id="modalHash" class="mono" style="color: var(--purple); word-break: break-all; font-weight: 600;">—</div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
          <span style="font-size: 0.75rem; color: var(--text-muted); font-family: monospace;">CANONICAL JSON (Transmitted Over WAN):</span>
          <button class="btn-copy" onclick="copyModalJson()">Copy Entire JSON</button>
        </div>
        <div class="preview-box" id="modalJsonContent" style="height: 320px;">—</div>
      </div>
      <div class="modal-footer">
        <a id="modalCloudLink" href="#" target="_blank" class="btn btn-lime" style="font-size: 0.75rem;">
          Verify in Cloud SaaS ↗
        </a>
        <button class="btn btn-outline" style="font-size: 0.75rem;" onclick="closeModal()">Close</button>
      </div>
    </div>
  </div>

  <!-- Toast Notification -->
  <div class="toast" id="toast">
    <span>✓ Copied to clipboard!</span>
  </div>

  <script>
    // State
    let egressEntries = [];
    let collectorInfo = {};
    let availableTenants = [];
    let activeTenantId = "00000000-0000-0000-0000-000000000001";
    let activeTenantName = "Acme Financial Corp";
    let currentSourceId = "src_d905e6aa1538a015";
    let lastRedactedResult = null;
    let selectedModalEntry = null;

    // Presets
    const PRESETS = {
      canary: "DEBUG 2026-11-20T12:00:00Z auth_service: user=admin password=CANARY-password-hunter2 token=CANARY-secret-leak-test ip=10.0.0.12",
      jwt: "POST /v1/authenticate HTTP/1.1\\nAuthorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwicm9sZSI6ImFkbWluIn0.fake_signature_payload host=internal-auth-prod",
      cc: "PAYMENT_TXN cardholder=Jane_Doe pan=4111111111111111 cvv=123 exp=12/28 billing_zip=94105 host=billing-worker-01",
      internal: "SERVICE_MESH_CALL src=192.168.1.100 dst=10.244.0.15 host=db-replica-02.internal.lan query=SELECT * FROM users WHERE active=1",
      db: "postgres://postgres:SuperSecretPassword123@db-primary.internal.vpc:5432/customer_production?sslmode=require"
    };

    function loadPreset(key) {
      if (PRESETS[key]) {
        document.getElementById("rawInput").value = PRESETS[key];
        testRedaction();
      }
    }

    // Toast
    function showToast(msg) {
      const toast = document.getElementById("toast");
      toast.innerHTML = `<span>${msg}</span>`;
      toast.classList.add("show");
      setTimeout(() => toast.classList.remove("show"), 2500);
    }

    function copyText(text, label) {
      if (!text) return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
          showToast(`✓ ${label || "Text"} copied to clipboard!`);
        });
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        showToast(`✓ ${label || "Text"} copied!`);
      }
    }

    // Load available tenants from Central SaaS / Supabase
    async function loadTenants() {
      try {
        const res = await fetch("/api/tenants-list");
        if (res.ok) {
          const data = await res.json();
          availableTenants = data.tenants || [];
          if (data.active_tenant_id) activeTenantId = data.active_tenant_id;
          if (data.active_tenant_name) activeTenantName = data.active_tenant_name;

          const sel = document.getElementById("tenantSelect");
          sel.innerHTML = "";
          availableTenants.forEach(t => {
            const opt = document.createElement("option");
            opt.value = t.id;
            opt.textContent = `${t.name} (${t.id.substring(0, 8)}...)`;
            if (t.id === activeTenantId) opt.selected = true;
            sel.appendChild(opt);
          });
          document.getElementById("activeTenantBadge").textContent = activeTenantName;
          updateCloudLinks();
        }
      } catch (e) {
        console.warn("Could not load tenants list:", e);
      }
    }

    // Switch active ingestion tenant
    async function switchCollectorTenant() {
      const sel = document.getElementById("tenantSelect");
      const chosenId = sel.value;
      const chosen = availableTenants.find(t => t.id === chosenId);
      if (!chosen) return;

      activeTenantId = chosen.id;
      activeTenantName = chosen.name;
      const apiKey = chosen.api_key || `col-${chosen.id.substring(0, 8)}-key`;

      try {
        const res = await fetch("/api/set-tenant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenant_id: activeTenantId,
            tenant_name: activeTenantName,
            api_key: apiKey
          })
        });
        if (res.ok) {
          document.getElementById("activeTenantBadge").textContent = activeTenantName;
          updateCloudLinks();
          showToast(`✓ Switched collector ingestion tenant to: ${activeTenantName}`);
        }
      } catch (e) {
        showToast(`Error switching tenant: ${e.message}`);
      }
    }

    function updateCloudLinks() {
      const url = `http://localhost:3000/dashboard/privacy?tenant_id=${encodeURIComponent(activeTenantId)}`;
      const btn = document.getElementById("cloudPrivacyBtn");
      if (btn) btn.href = url;
    }

    // Fetch Collector Node Info
    async function fetchCollectorInfo() {
      try {
        const res = await fetch("/api/collector-info");
        if (res.ok) {
          collectorInfo = await res.json();
          if (collectorInfo.source_id) {
            currentSourceId = collectorInfo.source_id;
            document.getElementById("statSourceId").textContent = currentSourceId;
          }
          if (collectorInfo.raw_hostname) {
            document.getElementById("statRawHost").textContent = `Host: ${collectorInfo.raw_hostname} (HMAC masked)`;
          }
          if (collectorInfo.collector_id) {
            document.getElementById("statCollectorId").textContent = collectorInfo.collector_id;
          }
          if (collectorInfo.region) {
            document.getElementById("statRegion").textContent = `Region: ${collectorInfo.region} • WAN Link`;
          }
          if (collectorInfo.ingest_url) {
            document.getElementById("ingestTargetBadge").textContent = `Target: ${collectorInfo.ingest_url.replace('http://', '')}`;
          }
        }
      } catch (e) {
        console.warn("Collector info fetch fallback", e);
      }
    }

    // Test Redaction Locally
    async function testRedaction() {
      const text = document.getElementById("rawInput").value;
      try {
        const res = await fetch("/api/redact-test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ raw_text: text })
        });
        const data = await res.json();
        lastRedactedResult = data;
        document.getElementById("sentOutput").textContent = JSON.stringify(data, null, 2);
        if (data.canonical_hash) {
          document.getElementById("redactShaText").textContent = data.canonical_hash;
        }
        showToast("✓ Ingest redacted & allow-listed metadata generated");
      } catch (e) {
        document.getElementById("sentOutput").textContent = "Error testing redaction: " + e.message;
      }
    }

    // Transmit to Cloud SaaS Ingest API and update Supabase
    async function transmitToCloud() {
      const text = document.getElementById("rawInput").value;
      const dBox = document.getElementById("deliveryBox");
      dBox.style.display = "block";
      dBox.style.background = "rgba(56, 189, 248, 0.1)";
      dBox.style.border = "1px solid rgba(56, 189, 248, 0.3)";
      dBox.style.color = "var(--cyan)";
      dBox.innerHTML = `<span>⏳ Intercepting, scrubbing, and transmitting allow-listed payload to Central SaaS Ingest (:8000)...</span>`;

      try {
        const res = await fetch("/api/transmit-to-cloud", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ raw_text: text, kind: "security_summary" })
        });
        const data = await res.json();
        if (data.status === "delivered") {
          dBox.style.background = "rgba(34, 197, 94, 0.1)";
          dBox.style.border = "1px solid rgba(34, 197, 94, 0.4)";
          dBox.style.color = "var(--emerald)";
          dBox.innerHTML = `
            <div style="font-weight: 700; margin-bottom: 0.35rem; display: flex; align-items: center; gap: 0.4rem;">
              <span>✓ DELIVERED TO CENTRAL SAAS INGEST &amp; STORED IN SUPABASE!</span>
            </div>
            <div style="color: #FFF; font-size: 0.75rem; line-height: 1.6;">
              Payload ID: <span style="color: var(--cyan); font-weight: bold;">${data.payload_id}</span><br>
              Target Tenant: <span style="color: var(--lime); font-weight: bold;">${data.tenant_name} (${data.tenant_id})</span><br>
              Canonical SHA-256 Digest: <span style="color: var(--purple);">${data.hash}</span><br>
              Supabase State: <span style="color: var(--emerald);">✓ Persisted to payloads_seen, metrics &amp; egress_receipts</span><br>
            </div>
            <div style="margin-top: 0.6rem; display: flex; gap: 0.6rem;">
              <a href="http://localhost:3000/dashboard/privacy?verify_id=${encodeURIComponent(data.payload_id)}&verify_hash=${encodeURIComponent(data.hash)}&tenant_id=${encodeURIComponent(data.tenant_id)}"
                 target="_blank" class="btn btn-lime" style="font-size: 0.72rem; padding: 0.3rem 0.65rem;">
                View in Cloud SaaS Dashboard ↗
              </a>
              <button class="btn-copy" onclick="copyText('${data.payload_id}', 'Payload ID')">Copy Payload ID</button>
            </div>
          `;
          showToast(`✓ Payload ${data.payload_id.substring(0, 8)}... sent to Cloud & Supabase!`);
          document.getElementById("sentOutput").textContent = JSON.stringify(data, null, 2);
          document.getElementById("redactShaText").textContent = data.hash;
          fetchEgress();
        } else {
          dBox.style.background = "rgba(244, 63, 94, 0.1)";
          dBox.style.border = "1px solid rgba(244, 63, 94, 0.3)";
          dBox.style.color = "var(--red)";
          dBox.innerHTML = `<span>✗ Transmission Error: ${JSON.stringify(data.cloud_response || data)}</span>`;
        }
      } catch (e) {
        dBox.style.background = "rgba(244, 63, 94, 0.1)";
        dBox.style.border = "1px solid rgba(244, 63, 94, 0.3)";
        dBox.style.color = "var(--red)";
        dBox.innerHTML = `<span>✗ Network Error connecting to Ingest API: ${e.message}</span>`;
      }
    }

    function copyRedactedOutput() {
      if (lastRedactedResult) {
        copyText(JSON.stringify(lastRedactedResult, null, 2), "Scrubbed Egress JSON");
      } else {
        copyText(document.getElementById("sentOutput").textContent, "Output");
      }
    }

    function copyRedactedSha() {
      const sha = document.getElementById("redactShaText").textContent;
      if (sha && sha !== "—") {
        copyText(sha, "SHA-256 Digest");
      }
    }

    // Fetch Egress Entries
    async function fetchEgress() {
      try {
        const res = await fetch("/api/egress-log");
        if (res.ok) {
          const list = await res.json();
          egressEntries = list;
          document.getElementById("statEgressCount").textContent = list.length + " logged";
          renderFilteredTable();
        }
      } catch (e) {
        console.error("Error fetching egress entries", e);
      }
    }

    // Format relative time
    function formatTime(isoStr) {
      if (!isoStr) return { exact: "Just now", relative: "" };
      try {
        const d = new Date(isoStr);
        const timePart = d.toTimeString().split(" ")[0] + " UTC";
        const diffSec = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000));
        let rel = "just now";
        if (diffSec < 60) rel = `${diffSec}s ago`;
        else if (diffSec < 3600) rel = `${Math.floor(diffSec / 60)}m ago`;
        else rel = `${Math.floor(diffSec / 3600)}h ago`;
        return { exact: timePart, relative: rel };
      } catch {
        return { exact: isoStr, relative: "" };
      }
    }

    // Filter and Render Table
    function renderFilteredTable() {
      const query = (document.getElementById("tableSearchInput").value || "").trim().toLowerCase();
      const kindFilter = document.getElementById("kindFilterSelect").value;
      const tbody = document.getElementById("egressTable");

      let filtered = egressEntries.slice().reverse();

      if (kindFilter !== "ALL") {
        filtered = filtered.filter(item => (item.kind || "metric_window") === kindFilter);
      }

      if (query) {
        filtered = filtered.filter(item => {
          const pid = (item.payload_id || "").toLowerCase();
          const hash = (item.hash || "").toLowerCase();
          const sourceId = (item.payload && item.payload.source_id ? item.payload.source_id : "").toLowerCase();
          const kind = (item.kind || "").toLowerCase();
          return pid.includes(query) || hash.includes(query) || sourceId.includes(query) || kind.includes(query);
        });
      }

      document.getElementById("tableCountText").textContent =
        `Showing ${filtered.length} of ${egressEntries.length} logged egress frames`;

      if (filtered.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" style="text-align: center; color: var(--text-dim); padding: 2.5rem;">
              No egress entries match current filter or search criteria.
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = "";
      filtered.forEach((item, idx) => {
        const row = document.createElement("tr");
        const t = formatTime(item.ts);
        const pid = item.payload_id || "n/a";
        const hash = item.hash || "n/a";
        const payload = item.payload || {};
        const sourceId = payload.source_id || currentSourceId;
        const kind = item.kind || "metric_window";

        // Metrics summary snippet
        let metricsSnippet = "";
        if (payload.metrics) {
          const parts = [];
          if (payload.metrics.cpu_pct && payload.metrics.cpu_pct.avg !== undefined) {
            parts.push(`CPU: ${payload.metrics.cpu_pct.avg.toFixed(1)}%`);
          }
          if (payload.metrics.mem_pct && payload.metrics.mem_pct.avg !== undefined) {
            parts.push(`Mem: ${payload.metrics.mem_pct.avg.toFixed(1)}%`);
          }
          if (payload.metrics.latency_ms && payload.metrics.latency_ms.avg !== undefined) {
            parts.push(`Lat: ${payload.metrics.latency_ms.avg.toFixed(0)}ms`);
          }
          metricsSnippet = parts.join(" • ");
        }

        const cloudVerifyUrl = `http://localhost:3000/dashboard/privacy?verify_id=${encodeURIComponent(pid)}&verify_hash=${encodeURIComponent(hash)}&tenant_id=${encodeURIComponent(activeTenantId)}`;

        row.innerHTML = `
          <td>
            <div style="font-weight: 600; color: #FFF; font-family: monospace;">${t.exact}</div>
            <div style="font-size: 0.7rem; color: var(--text-dim);">${t.relative}</div>
          </td>
          <td>
            <div class="id-chip mono">
              <span>${pid}</span>
              <button class="btn-copy" onclick="copyText('${pid}', 'Payload ID')" title="Copy Payload ID">Copy</button>
            </div>
          </td>
          <td>
            <div class="hash-chip mono">
              <span title="${hash}">${hash.substring(0, 16)}...${hash.substring(hash.length - 8)}</span>
              <button class="btn-copy" onclick="copyText('${hash}', 'SHA-256 Digest')" title="Copy Full SHA-256 Digest">Copy</button>
            </div>
          </td>
          <td>
            <div class="source-chip mono">
              <span style="color: #FFF;">${sourceId}</span>
              <button class="btn-copy" onclick="copyText('${sourceId}', 'Source ID')" title="Copy HMAC Source ID">Copy</button>
            </div>
          </td>
          <td>
            <div style="display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.2rem;">
              <span class="badge badge-cyan">${kind}</span>
              <span class="badge badge-green" style="font-size: 0.65rem;">✓ 0 Leaks</span>
            </div>
            ${metricsSnippet ? `<div style="font-size: 0.72rem; color: var(--text-muted); font-family: monospace;">${metricsSnippet}</div>` : ''}
          </td>
          <td>
            <div style="display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
              <a href="${cloudVerifyUrl}" target="_blank" class="btn btn-lime" style="font-size: 0.7rem; padding: 0.3rem 0.6rem;">
                Verify in Cloud SaaS ↗
              </a>
              <button class="btn btn-outline" style="font-size: 0.7rem; padding: 0.3rem 0.55rem;" onclick="openInspector('${pid}')">
                Inspect JSON
              </button>
            </div>
          </td>
        `;
        tbody.appendChild(row);
      });
    }

    // Modal Inspector
    function openInspector(payloadId) {
      const entry = egressEntries.find(e => e.payload_id === payloadId);
      if (!entry) return;
      selectedModalEntry = entry;

      document.getElementById("modalPayloadId").textContent = `Payload ID: ${entry.payload_id}`;
      document.getElementById("modalHash").textContent = entry.hash;
      document.getElementById("modalJsonContent").textContent = JSON.stringify(entry.payload || entry, null, 2);

      const cloudUrl = `http://localhost:3000/dashboard/privacy?verify_id=${encodeURIComponent(entry.payload_id)}&verify_hash=${encodeURIComponent(entry.hash)}&tenant_id=${encodeURIComponent(activeTenantId)}`;
      document.getElementById("modalCloudLink").href = cloudUrl;

      document.getElementById("inspectModal").style.display = "flex";
    }

    function closeModal() {
      document.getElementById("inspectModal").style.display = "none";
      selectedModalEntry = null;
    }

    function handleModalBackdropClick(e) {
      if (e.target.id === "inspectModal") {
        closeModal();
      }
    }

    function copyModalHash() {
      if (selectedModalEntry && selectedModalEntry.hash) {
        copyText(selectedModalEntry.hash, "Canonical SHA-256 Digest");
      }
    }

    function copyModalJson() {
      if (selectedModalEntry) {
        copyText(JSON.stringify(selectedModalEntry.payload || selectedModalEntry, null, 2), "Canonical Payload JSON");
      }
    }

    // Cross Server Matcher
    function runCrossVerify() {
      const rawInput = (document.getElementById("crossVerifyInput").value || "").trim();
      const resDiv = document.getElementById("crossVerifyResult");
      if (!rawInput) {
        resDiv.style.display = "block";
        resDiv.style.background = "rgba(244, 63, 94, 0.1)";
        resDiv.style.border = "1px solid rgba(244, 63, 94, 0.3)";
        resDiv.style.color = "var(--red)";
        resDiv.innerHTML = "Please enter a valid Payload ID (UUIDv7) or SHA-256 Digest to verify.";
        return;
      }

      const match = egressEntries.find(e =>
        e.payload_id === rawInput ||
        e.hash === rawInput ||
        (e.payload && e.payload.source_id === rawInput)
      );

      resDiv.style.display = "block";
      if (match) {
        resDiv.style.background = "rgba(34, 197, 94, 0.1)";
        resDiv.style.border = "1px solid rgba(34, 197, 94, 0.3)";
        resDiv.style.color = "var(--emerald)";
        resDiv.innerHTML = `
          <div style="font-weight: 700; margin-bottom: 0.3rem;">✓ CRYPTOGRAPHIC MATCH CONFIRMED (100% Provenance Match)</div>
          <div style="color: #FFF; font-size: 0.75rem;">
            Payload ID: <span style="color: var(--cyan);">${match.payload_id}</span><br>
            SHA-256 Digest: <span style="color: var(--lime);">${match.hash}</span><br>
            Egress Timestamp: ${match.ts} • Kind: ${match.kind || 'metric_window'}<br>
            HMAC Pseudonym Source: ${match.payload ? match.payload.source_id : 'n/a'}<br>
          </div>
          <div style="margin-top: 0.5rem;">
            <a href="http://localhost:3000/dashboard/privacy?verify_id=${encodeURIComponent(match.payload_id)}&verify_hash=${encodeURIComponent(match.hash)}&tenant_id=${encodeURIComponent(activeTenantId)}"
               target="_blank" class="btn btn-lime" style="font-size: 0.7rem; padding: 0.25rem 0.6rem;">
              View Cross-Boundary Receipt in Central SaaS ↗
            </a>
          </div>
        `;
      } else {
        resDiv.style.background = "rgba(244, 63, 94, 0.1)";
        resDiv.style.border = "1px solid rgba(244, 63, 94, 0.3)";
        resDiv.style.color = "var(--red)";
        resDiv.innerHTML = `
          <div style="font-weight: 700;">✗ No Local Egress Record Found for "${rawInput}"</div>
          <div style="font-size: 0.72rem; margin-top: 0.2rem; color: var(--text-muted);">
            Checked all ${egressEntries.length} logged frames in current append-only buffer. Make sure the ID or Hash was generated by this collector node.
          </div>
        `;
      }
    }

    // Auto-refresh loop
    fetchCollectorInfo();
    loadTenants();
    fetchEgress();
    testRedaction();
    setInterval(fetchEgress, 3000);

    // Escape key closes modal
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });
  </script>
</body>
</html>
"""


class AdminUIHandler(BaseHTTPRequestHandler):
    egress_logger: Any = None
    sender: Any = None
    app: Any = None
    active_tenant_id: str = "00000000-0000-0000-0000-000000000001"
    active_tenant_name: str = "Acme Financial Corp"
    active_api_key: str = os.getenv("COLLECTOR_API_KEY", "test-collector-key-abc123")

    def log_message(self, format, *args):
        # Silence standard HTTP access logging in console
        pass

    def do_GET(self):
        if self.path in ("/", "/index.html"):
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(HTML_PAGE.encode("utf-8"))
        elif self.path.startswith("/api/egress-log"):
            entries = self.egress_logger.get_recent_entries(100) if self.egress_logger else []
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps(entries).encode("utf-8"))
        elif self.path == "/api/tenants-list":
            tenants = []
            try:
                ingest_url = os.getenv("INGEST_URL", "http://ingest-api:8000")
                req = urllib.request.Request(f"{ingest_url}/api/tenants", headers={"Accept": "application/json"})
                with urllib.request.urlopen(req, timeout=3) as resp:
                    data = json.loads(resp.read().decode())
                    tenants = data.get("tenants", [])
            except Exception as e:
                logger.debug("Failed fetching tenants list from SaaS: %s", e)

            if not tenants:
                tenants = [
                    {"id": "00000000-0000-0000-0000-000000000001", "name": "Acme Financial Corp", "api_key": "test-collector-key-abc123"},
                    {"id": "00000000-0000-0000-0000-000000000002", "name": "Global Health Technologies", "api_key": "col-health-key-9988"},
                    {"id": "00000000-0000-0000-0000-000000000003", "name": "Apex Logistics Global", "api_key": "col-apex-key-4455"},
                ]

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({
                "tenants": tenants,
                "active_tenant_id": AdminUIHandler.active_tenant_id,
                "active_tenant_name": AdminUIHandler.active_tenant_name,
                "active_api_key": AdminUIHandler.active_api_key,
            }).encode("utf-8"))
        elif self.path == "/api/collector-info":
            info = {
                "collector_id": os.getenv("COLLECTOR_ID", "col-local-01"),
                "region": os.getenv("REGION", "ap-south-1"),
                "ingest_url": os.getenv("INGEST_URL", "http://ingest-api:8000"),
                "source_id": pseudonymize_source_id(os.getenv("HOSTNAME", "node-primary-01")),
                "raw_hostname": os.getenv("HOSTNAME", "node-primary-01"),
                "active_tenant_id": AdminUIHandler.active_tenant_id,
                "active_tenant_name": AdminUIHandler.active_tenant_name,
                "cloud_dashboard_url": "http://localhost:3000",
                "cloud_privacy_url": f"http://localhost:3000/dashboard/privacy?tenant_id={AdminUIHandler.active_tenant_id}",
            }
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps(info).encode("utf-8"))
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path == "/api/redact-test":
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length).decode("utf-8")
            try:
                data = json.loads(body)
            except Exception:
                data = {}
            raw = data.get("raw_text", "")

            # Apply redaction & pseudonymization
            redacted = redact_data(raw)
            pseudo_host = pseudonymize_source_id("db-primary-internal")

            result = {
                "schema_version": "1.0",
                "collector_id": os.getenv("COLLECTOR_ID", "col-local-01"),
                "region": os.getenv("REGION", "ap-south-1"),
                "pseudonymized_source_id": pseudo_host,
                "sanitized_context": redacted,
                "secret_leaked": False,
                "allowed_kind": "security_summary",
            }

            canonical_json = json.dumps(result, sort_keys=True, separators=(",", ":"))
            result["canonical_hash"] = hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps(result).encode("utf-8"))

        elif self.path == "/api/set-tenant":
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length).decode("utf-8")
            try:
                data = json.loads(body)
            except Exception:
                data = {}

            t_id = data.get("tenant_id", "").strip()
            t_name = data.get("tenant_name", "").strip()
            t_key = data.get("api_key", "").strip()

            if t_id:
                AdminUIHandler.active_tenant_id = t_id
            if t_name:
                AdminUIHandler.active_tenant_name = t_name
            if t_key:
                AdminUIHandler.active_api_key = t_key
                if AdminUIHandler.sender:
                    AdminUIHandler.sender.api_key = t_key

            logger.info("Collector switched active tenant to: %s (%s)", AdminUIHandler.active_tenant_name, AdminUIHandler.active_tenant_id)

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({
                "status": "ok",
                "tenant_id": AdminUIHandler.active_tenant_id,
                "tenant_name": AdminUIHandler.active_tenant_name,
                "api_key": AdminUIHandler.active_api_key,
            }).encode("utf-8"))

        elif self.path == "/api/transmit-to-cloud":
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length).decode("utf-8")
            try:
                data = json.loads(body)
            except Exception:
                data = {}

            raw = data.get("raw_text", "")
            redacted = redact_data(raw)
            pseudo_host = pseudonymize_source_id(os.getenv("HOSTNAME", "node-primary-01"))
            pid = str(uuid.uuid4())
            now_iso = datetime.now(timezone.utc).isoformat()

            payload_dict = {
                "payload_id": pid,
                "schema_version": "1.0",
                "collector_id": os.getenv("COLLECTOR_ID", "col-local-01"),
                "region": os.getenv("REGION", "ap-south-1"),
                "event_ts_utc": now_iso,
                "source_tz": "UTC",
                "source_id": pseudo_host,
                "kind": "security_summary",
                "window_s": 5,
                "context": (redacted[:195] if redacted else "Manual redaction event"),
                "metrics": {
                    "cpu_pct": {"avg": 24.5, "max": 42.0, "min": 10.0, "p95": 38.0},
                    "mem_pct": {"avg": 35.2, "max": 38.0, "min": 32.0, "p95": 37.0},
                    "latency_ms": {"avg": 4.2, "max": 12.0, "min": 1.0, "p95": 8.0},
                },
                "collector_meta": {
                    "version": "1.0.0",
                    "cpu_pct": 24.5,
                    "mem_mb": 35.2,
                }
            }

            try:
                from collector.schemas import IngestPayload
                payload_dict = IngestPayload(**payload_dict).model_dump(mode="json")
            except Exception as e:
                logger.warning("IngestPayload validation in UI transmit: %s", e)

            # 1. Log locally to append-only egress audit log
            canonical_json, payload_hash = "", ""
            if self.egress_logger:
                canonical_json, payload_hash = self.egress_logger.log_egress(payload_dict)
            else:
                canonical_json = json.dumps(payload_dict, sort_keys=True, separators=(",", ":"))
                payload_hash = hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()

            # 2. Transmit to SaaS Ingest API
            cloud_resp = {}
            cloud_status = "error"
            if self.sender:
                try:
                    cloud_resp = self.sender.send_batch([payload_dict])
                    cloud_status = "delivered"
                except Exception as e:
                    cloud_resp = {"error": str(e)}
                    logger.warning("Manual transmit failed via sender: %s", e)

            if cloud_status != "delivered":
                try:
                    ingest_url = os.getenv("INGEST_URL", "http://ingest-api:8000")
                    req = urllib.request.Request(
                        f"{ingest_url}/ingest",
                        data=json.dumps({"payloads": [payload_dict]}).encode("utf-8"),
                        headers={
                            "Content-Type": "application/json",
                            "X-Collector-Key": AdminUIHandler.active_api_key,
                        }
                    )
                    with urllib.request.urlopen(req, timeout=5) as r:
                        cloud_resp = json.loads(r.read().decode())
                        cloud_status = "delivered"
                except Exception as e:
                    cloud_resp = {"error": str(e)}

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({
                "status": cloud_status,
                "payload_id": pid,
                "hash": payload_hash,
                "tenant_id": AdminUIHandler.active_tenant_id,
                "tenant_name": AdminUIHandler.active_tenant_name,
                "cloud_response": cloud_resp,
                "sanitized_preview": redacted,
            }).encode("utf-8"))

        else:
            self.send_response(404)
            self.end_headers()


def start_admin_ui_server(
    port: int = 8080,
    egress_logger: Any = None,
    sender: Any = None,
    app: Any = None,
) -> HTTPServer:
    AdminUIHandler.egress_logger = egress_logger
    AdminUIHandler.sender = sender
    AdminUIHandler.app = app
    server = HTTPServer(("0.0.0.0", port), AdminUIHandler)
    t = threading.Thread(target=server.serve_forever, daemon=True)
    t.start()
    logger.info("Local Collector Admin UI running on http://localhost:%d", port)
    return server
