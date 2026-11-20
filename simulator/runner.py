"""
Simulator Scenario Runner — tasks 0.6, 0.7.
Command-line runner to inject and test scenarios:
- normal
- spike
- memory_leak
- db_outage_cascade
- login_burst
- net_latency
"""

from __future__ import annotations

import argparse
import json
import logging
import time
from simulator.generator import generate_telemetry_stream

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("simulator")


def main():
    parser = argparse.ArgumentParser(description="AIOps Scenario Simulator")
    parser.add_argument(
        "--scenario",
        default="normal",
        choices=["normal", "spike", "memory_leak", "db_outage_cascade", "login_burst", "net_latency"],
        help="Telemetry failure scenario to simulate",
    )
    parser.add_argument("--interval", type=float, default=2.0, help="Interval between event emissions in seconds")
    parser.add_argument("--count", type=int, default=30, help="Number of ticks to emit (0 for infinite)")
    parser.add_argument("--output", default="", help="Optional JSONL file path to write emitted records")

    args = parser.parse_args()

    logger.info("Starting simulator scenario: '%s' (interval: %.1fs)", args.scenario, args.interval)

    stream = generate_telemetry_stream(
        scenario=args.scenario,
        interval_s=args.interval,
        total_ticks=args.count if args.count > 0 else 999999,
    )

    out_file = open(args.output, "a", encoding="utf-8") if args.output else None

    try:
        for idx, event in enumerate(stream):
            line = json.dumps(event)
            kind_tag = event.get("kind") or event.get("category") or event.get("source") or "event"
            print(f"[{kind_tag}] {line}")
            if out_file:
                out_file.write(line + "\n")
                out_file.flush()
            time.sleep(args.interval)
    except KeyboardInterrupt:
        logger.info("Simulator stopped by user.")
    finally:
        if out_file:
            out_file.close()


if __name__ == "__main__":
    main()
