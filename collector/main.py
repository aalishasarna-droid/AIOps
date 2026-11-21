"""
Collector Main Entrypoint — Tier 1 Customer Environment.
Orchestrates collection, local normalization, redaction, aggregation, egress logging, and delivery.
"""

from __future__ import annotations

import logging
import os
import signal
import sys
import time
import uuid
from datetime import datetime, timezone

from collector.schemas import IngestPayload, PayloadKind, CollectorMeta
from collector.policy.engine import PolicyEngine
from collector.aggregate.window import MetricWindowAggregator
from collector.analyze.failed_login import FailedLoginDetector
from collector.analyze.ewma import MetricDeviationTracker
from collector.redact.scrubbers import redact_data
from collector.redact.pseudonym import pseudonymize_source_id
from collector.redact.validator import validate_and_sanitize_payload_fields
from collector.outbox.store import LocalOutboxStore
from collector.egress.logger import EgressLogger
from collector.transport.sender import IngestSender
from collector.sources.host import HostMetricsCollector
from collector.sources.probe import NetworkProbe
from collector.admin_ui.server import start_admin_ui_server

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("collector")


def generate_uuidv7() -> str:
    """Generate a standard UUID string for payload_id."""
    return str(uuid.uuid4())


class CollectorApp:
    def __init__(self):
        self.running = True
        self.collector_id = os.getenv("COLLECTOR_ID", "col-local-01")
        self.source_id_raw = os.getenv("HOSTNAME", "node-primary-01")
        self.pseudo_source_id = pseudonymize_source_id(self.source_id_raw)

        # Core components
        self.policy = PolicyEngine()
        self.outbox_store = LocalOutboxStore(os.getenv("RAW_DB_PATH", "/app/data/collector.db"))
        self.egress_logger = EgressLogger(os.getenv("EGRESS_LOG_PATH", "/app/data/egress.log"))
        self.aggregator = MetricWindowAggregator()
        self.deviation_tracker = MetricDeviationTracker()
        self.failed_login_detector = FailedLoginDetector(window_s=10, threshold=5)
        self.sender = IngestSender()

        # Telemetry sources
        self.host_collector = HostMetricsCollector()
        self.probe = NetworkProbe()

        # Start admin UI (localhost only)
        ui_port = int(os.getenv("ADMIN_UI_PORT", "8080"))
        try:
            start_admin_ui_server(port=ui_port, egress_logger=self.egress_logger, sender=self.sender, app=self)
        except Exception as e:
            logger.warning("Admin UI could not be started: %s", e)

    def stop(self, *args):
        logger.info("Stopping collector...")
        self.running = False

    def run_loop(self):
        logger.info("Collector %s started. Pseudo Source ID: %s", self.collector_id, self.pseudo_source_id)
        window_s = self.policy.window_seconds
        last_flush = time.time()
        last_prune = time.time()

        while self.running:
            now = time.time()

            # 1. Collect telemetry readings
            host_metrics = self.host_collector.collect()
            probe_metrics = self.probe.collect()
            all_metrics = {**host_metrics, **probe_metrics}

            # 2. Store raw metrics in local store (TTL bounded)
            if all_metrics:
                self.outbox_store.save_raw_event(
                    event_id=str(uuid.uuid4()),
                    kind="host_metrics",
                    raw_data=all_metrics,
                    ttl_s=self.policy.retention_hours * 3600,
                )

            # 3. Feed allow-listed metrics to aggregator & EWMA
            deviations = {}
            for k, v in all_metrics.items():
                if self.policy.is_metric_allowed(k):
                    self.aggregator.add_reading(k, v)
                    z = self.deviation_tracker.record_and_score(k, v)
                    if abs(z) >= 2.0:
                        deviations[k] = z

            # 4. Check if tumbling window expired
            if now - last_flush >= window_s:
                flushed_metrics = self.aggregator.flush_window()
                last_flush = now

                if flushed_metrics:
                    payload_id = generate_uuidv7()
                    ts = datetime.now(timezone.utc)

                    payload_fields = {
                        "payload_id": payload_id,
                        "schema_version": "1.0",
                        "collector_id": self.collector_id,
                        "region": os.getenv("REGION", "ap-south-1"),
                        "event_ts_utc": ts,
                        "source_tz": "UTC",
                        "source_id": self.pseudo_source_id,
                        "kind": PayloadKind.metric_window,
                        "window_s": window_s,
                        "metrics": flushed_metrics,
                        "deviation": deviations if deviations else None,
                        "collector_meta": CollectorMeta(
                            version="1.0.0",
                            cpu_pct=all_metrics.get("cpu_pct"),
                            mem_mb=all_metrics.get("mem_pct"),
                        ),
                    }

                    # Sanitize and validate against Pydantic schema
                    validated_fields = validate_and_sanitize_payload_fields(payload_fields)
                    ingest_payload = IngestPayload(**validated_fields)
                    payload_dict = ingest_payload.model_dump(mode="json")

                    # Log to egress log BEFORE sending
                    self.egress_logger.log_egress(payload_dict)

                    # Enqueue in outbox
                    self.outbox_store.queue_outbox(payload_id, payload_dict)

            # 5. Flush outbox to SaaS
            pending = self.outbox_store.get_pending_payloads(limit=20)
            if pending:
                batch_payloads = [item["payload"] for item in pending]
                try:
                    resp = self.sender.send_batch(batch_payloads)
                    logger.debug("Delivered %d payloads to SaaS. Resp: %s", len(batch_payloads), resp)
                    for item in pending:
                        self.outbox_store.mark_sent(item["payload_id"])
                except Exception as e:
                    logger.warning("Failed to deliver batch to SaaS (outbox queued): %s", e)
                    for item in pending:
                        self.outbox_store.mark_failed(item["payload_id"])

            # 6. Periodic raw store pruning (every 10 minutes)
            if now - last_prune > 600:
                deleted = self.outbox_store.purge_expired_raw()
                if deleted > 0:
                    logger.info("Pruned %d expired raw events from local store", deleted)
                last_prune = now

            time.sleep(1.0)


def main():
    app = CollectorApp()
    signal.signal(signal.SIGINT, app.stop)
    signal.signal(signal.SIGTERM, app.stop)
    app.run_loop()


if __name__ == "__main__":
    main()
