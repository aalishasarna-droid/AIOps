#!/usr/bin/env python3
"""
CLI Tool: Inspect SQLite Local Store & Transactional Outbox (Tier 1 Collector)
Architecture ref: architecture.md §4, §5, §12
"""

import json
import os
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path


def inspect_database(db_path: str = "/app/data/collector.db"):
    path = Path(db_path)
    if not path.exists():
        print(f"❌ Database file not found at {db_path}")
        print("Checking fallback /tmp/collector.db ...")
        if Path("/tmp/collector.db").exists():
            path = Path("/tmp/collector.db")
        else:
            sys.exit(1)

    conn = sqlite3.connect(str(path))
    conn.row_factory = sqlite3.Row

    print("=" * 78)
    print("🏛️  AIOPS TIER 1 LOCAL COLLECTOR — SQLITE AUDIT INSPECTOR")
    print("=" * 78)
    print(f"📁 Database Path: {path} (Docker Volume: collector_raw)")
    print("🔒 Trust Boundary: Tier 1 Customer Environment (Strictly Local)\n")

    # 1. Schema & Summary
    print("── 1. DATABASE TABLES & RECORD COUNTS ────────────────────────────────────")
    try:
        raw_cnt = conn.execute("SELECT count(*) FROM raw_events").fetchone()[0]
    except Exception:
        raw_cnt = 0
    try:
        outbox_cnt = conn.execute("SELECT count(*) FROM outbox_payloads").fetchone()[0]
        sent_cnt = conn.execute("SELECT count(*) FROM outbox_payloads WHERE status = 'sent'").fetchone()[0]
        pending_cnt = conn.execute("SELECT count(*) FROM outbox_payloads WHERE status = 'pending'").fetchone()[0]
    except Exception:
        outbox_cnt, sent_cnt, pending_cnt = 0, 0, 0

    print(f"• raw_events (Ephemeral Local Raw Store):   {raw_cnt:,} records")
    print(f"• outbox_payloads (Transactional Egress):    {outbox_cnt:,} records (Sent: {sent_cnt:,}, Pending: {pending_cnt:,})\n")

    # 2. Table Schemas
    print("── 2. TABLE DDL SCHEMAS ──────────────────────────────────────────────────")
    for r in conn.execute("SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';"):
        print(f"Table [{r['name']}]:")
        for line in (r['sql'] or '').splitlines():
            print(f"  {line}")
    print()

    # 3. Latest Raw Event
    print("── 3. LATEST RAW LOCAL EVENT (Stays Local — Never Leaves Tier 1) ─────────")
    latest_raw = conn.execute("SELECT * FROM raw_events ORDER BY event_ts DESC LIMIT 1").fetchone()
    if latest_raw:
        dt = datetime.fromtimestamp(latest_raw["event_ts"], tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        exp_dt = datetime.fromtimestamp(latest_raw["expires_at"], tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        print(f"Event ID:      {latest_raw['event_id']}")
        print(f"Timestamp:     {dt}")
        print(f"Expires (TTL): {exp_dt} (Automatic Pruning)")
        print(f"Event Kind:    {latest_raw['kind']}")
        try:
            parsed = json.loads(latest_raw["raw_data"])
            print(f"Raw Keys ({len(parsed)}):  {list(parsed.keys())[:10]}...")
            print(f"Raw Sample:    {json.dumps(parsed, indent=2)[:280]}...")
        except Exception:
            print(f"Raw Content:   {latest_raw['raw_data'][:160]}...")
    else:
        print("No raw events logged yet.")
    print()

    # 4. Latest Outbox Payload
    print("── 4. LATEST OUTBOX EGRESS PAYLOAD (Allow-Listed & Sealed for SaaS) ──────")
    latest_out = conn.execute("SELECT * FROM outbox_payloads ORDER BY created_at DESC LIMIT 1").fetchone()
    if latest_out:
        dt = datetime.fromtimestamp(latest_out["created_at"], tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        p = json.loads(latest_out["payload_json"])
        print(f"Payload ID:    {latest_out['payload_id']} (UUIDv7)")
        print(f"Delivery:      {latest_out['status'].upper()} (Retries: {latest_out['retries']})")
        print(f"Created UTC:   {dt}")
        print(f"Source ID:     {p.get('source_id')} (Keyed HMAC Pseudonym)")
        print(f"Payload Kind:  {p.get('kind')}")
        print(f"Window (sec):  {p.get('window_s')}s")
        print(f"Metrics ({len(p.get('metrics', {}))}): {list(p.get('metrics', {}).keys())}")
        print("Sample Metric Value:")
        first_metric = next(iter(p.get("metrics", {}).items()), None)
        if first_metric:
            print(f"  '{first_metric[0]}': {first_metric[1]}")
    else:
        print("No outbox payloads logged yet.")

    print("=" * 78)


if __name__ == "__main__":
    db_file = sys.argv[1] if len(sys.argv) > 1 else "/app/data/collector.db"
    inspect_database(db_file)
