"""
Replay adapter for organizer-provided or recorded telemetry streams.
Ref: architecture.md §11, task.md §0.8, §1.4
"""

from __future__ import annotations

import csv
import json
import logging
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Generator, Optional

logger = logging.getLogger(__name__)


class StreamReplayAdapter:
    """
    Reads recorded or organizer-provided JSONL / CSV event files
    and emits standardized raw events for the collector pipeline.
    """

    def __init__(
        self,
        file_path: str | Path,
        speed_factor: float = 1.0,
        loop: bool = False,
    ):
        self.file_path = Path(file_path)
        self.speed_factor = max(0.01, speed_factor)
        self.loop = loop

    def read_records(self) -> Generator[dict[str, Any], None, None]:
        """Yield raw records from JSONL or CSV file."""
        if not self.file_path.exists():
            logger.warning("Replay file not found: %s", self.file_path)
            return

        while True:
            is_jsonl = self.file_path.suffix.lower() in [".jsonl", ".json"]
            last_ts: Optional[float] = None

            with open(self.file_path, "r", encoding="utf-8") as f:
                if is_jsonl:
                    for line in f:
                        line = line.strip()
                        if not line:
                            continue
                        try:
                            record = json.loads(line)
                            yield record
                        except json.JSONDecodeError as e:
                            logger.error("Failed to parse JSON line: %s", e)
                else:
                    reader = csv.DictReader(f)
                    for row in reader:
                        yield dict(row)

            if not self.loop:
                break
            time.sleep(1.0)
