"""
Failed-login detector — task 1.13.
Tracks authentication failures in a sliding window.
Emits only an aggregated summary {event: auth_anomaly, count, window_s, severity}.
Raw credentials and usernames NEVER cross the boundary.
"""

from __future__ import annotations

import collections
import time
from typing import Optional
from collector.schemas import Severity


class FailedLoginDetector:
    """Sliding-window authentication failure detector."""

    def __init__(self, window_s: int = 10, threshold: int = 5):
        self.window_s = window_s
        self.threshold = threshold
        # Deque of timestamps of failed login events
        self.timestamps: collections.deque[float] = collections.deque()
        self.last_emitted_ts: float = 0.0

    def record_failure(self, now: Optional[float] = None) -> Optional[dict]:
        """
        Record a failed login attempt.
        If threshold is breached in the sliding window, returns a summary alert dict.
        """
        t = now or time.time()
        self.timestamps.append(t)

        # Evict timestamps outside the window
        cutoff = t - self.window_s
        while self.timestamps and self.timestamps[0] < cutoff:
            self.timestamps.popleft()

        count = len(self.timestamps)
        # Suppress repeated alerts within the same window
        if count >= self.threshold and (t - self.last_emitted_ts) >= self.window_s:
            self.last_emitted_ts = t
            return {
                "event": "auth_anomaly",
                "count": count,
                "window_s": self.window_s,
                "severity": Severity.critical if count >= self.threshold * 2 else Severity.warning,
                "context": f"Failed login burst: {count} failures in {self.window_s}s window",
            }
        return None
