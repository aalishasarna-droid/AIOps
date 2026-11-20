"""
Local EWMA (Exponentially Weighted Moving Average) deviation score — task 1.14.
Maintains a running mean and variance to calculate standard deviation scores.
"""

from __future__ import annotations

import math
from typing import Optional


class EWMADetector:
    """Computes online EWMA baseline and deviation (z-score) for a single metric."""

    def __init__(self, alpha: float = 0.2):
        self.alpha = alpha
        self.mean: Optional[float] = None
        self.variance: Optional[float] = None

    def update(self, value: float) -> float:
        """
        Update the EWMA with a new reading and return the deviation score (z-score).
        A score > 3.0 indicates a significant statistical anomaly.
        """
        if self.mean is None:
            self.mean = value
            self.variance = 0.0
            return 0.0

        diff = value - self.mean
        # Update variance estimate
        incr = self.alpha * (diff ** 2)
        self.variance = (1 - self.alpha) * (self.variance or 0.0) + incr
        # Update mean
        self.mean += self.alpha * diff

        std_dev = math.sqrt(self.variance) if self.variance and self.variance > 0 else 1.0
        z_score = diff / max(std_dev, 0.001)
        return round(z_score, 2)


class MetricDeviationTracker:
    """Tracks EWMA deviations across multiple metric streams."""

    def __init__(self, alpha: float = 0.2):
        self.alpha = alpha
        self.detectors: dict[str, EWMADetector] = {}

    def record_and_score(self, metric_name: str, value: float) -> float:
        if metric_name not in self.detectors:
            self.detectors[metric_name] = EWMADetector(alpha=self.alpha)
        return self.detectors[metric_name].update(value)
