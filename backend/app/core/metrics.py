from __future__ import annotations

import threading
import time
from collections import defaultdict
from typing import Any


class Metrics:
    """Process-local counters. Intended for /status and structured logs.

    These are not a replacement for Prometheus; they are cheap diagnostics that
    keep the STAGE 2 footprint small and make cache/rate behaviour observable.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._counters: dict[str, int] = defaultdict(int)
        self._latencies: dict[str, list[float]] = defaultdict(list)
        self.started_at = time.time()

    def incr(self, name: str, value: int = 1) -> None:
        with self._lock:
            self._counters[name] += value

    def observe(self, name: str, duration_ms: float) -> None:
        with self._lock:
            values = self._latencies[name]
            values.append(duration_ms)
            if len(values) > 500:
                del values[:250]

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            counters = dict(self._counters)
            latencies = {name: sorted(values) for name, values in self._latencies.items()}
        p95 = {}
        for name, values in latencies.items():
            if values:
                index = min(len(values) - 1, int(len(values) * 0.95))
                p95[name] = round(values[index], 2)
        return {
            "uptime_seconds": int(time.time() - self.started_at),
            "counters": counters,
            "p95_ms": p95,
        }
