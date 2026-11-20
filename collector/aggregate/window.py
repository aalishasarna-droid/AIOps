"""
Windowed metric aggregator — task 1.12.
Computes tumbling window summaries (avg, min, max, p50, p95, p99, count).
"""

from __future__ import annotations

import math
from typing import Sequence
from collector.schemas import MetricValue


def compute_percentile(sorted_data: Sequence[float], percentile: float) -> float:
    """Calculate the given percentile from sorted numbers (0-100)."""
    if not sorted_data:
        return 0.0
    k = (len(sorted_data) - 1) * (percentile / 100.0)
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return sorted_data[int(k)]
    d0 = sorted_data[int(f)] * (c - k)
    d1 = sorted_data[int(c)] * (k - f)
    return d0 + d1


class MetricWindowAggregator:
    """Collects individual metric readings within a time window and aggregates them."""

    def __init__(self):
        self.series: dict[str, list[float]] = {}

    def add_reading(self, name: str, value: float) -> None:
        """Add a single numeric reading to the current window buffer."""
        if not isinstance(value, (int, float)) or math.isnan(value):
            return
        if name not in self.series:
            self.series[name] = []
        self.series[name].append(float(value))

    def flush_window(self) -> dict[str, MetricValue]:
        """
        Compute aggregates for all metrics in the buffer and reset the window.
        Returns a mapping of metric_name -> MetricValue.
        """
        result: dict[str, MetricValue] = {}

        for name, values in self.series.items():
            if not values:
                continue
            sorted_vals = sorted(values)
            n = len(sorted_vals)
            avg_val = sum(sorted_vals) / n

            result[name] = MetricValue(
                avg=round(avg_val, 2),
                min=round(sorted_vals[0], 2),
                max=round(sorted_vals[-1], 2),
                p50=round(compute_percentile(sorted_vals, 50), 2),
                p95=round(compute_percentile(sorted_vals, 95), 2),
                p99=round(compute_percentile(sorted_vals, 99), 2),
                count=n,
            )

        self.series.clear()
        return result
