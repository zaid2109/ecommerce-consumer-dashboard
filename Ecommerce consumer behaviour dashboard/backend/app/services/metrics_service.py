from __future__ import annotations

import time
from collections import defaultdict
from threading import Lock
from typing import Any, Dict

# Simple in-memory metrics store (for production, use Prometheus or similar)
_metrics_lock = Lock()
_request_counts: Dict[str, int] = defaultdict(int)
_request_durations_ms: Dict[str, list] = defaultdict(list)
_error_counts: Dict[str, int] = defaultdict(int)
_ml_training_times_ms: Dict[str, list] = defaultdict(list)
_dataset_sizes: Dict[str, int] = defaultdict(int)
_cache_hits: Dict[str, int] = defaultdict(int)
_cache_misses: Dict[str, int] = defaultdict(int)


def record_request(endpoint: str, method: str, status_code: int, duration_ms: float, tenant_id: str | None = None):
    """Record request metrics."""
    key = f"{method} {endpoint}"
    with _metrics_lock:
        _request_counts[key] += 1
        _request_durations_ms[key].append(duration_ms)
        if status_code >= 400:
            _error_counts[key] += 1
        # Keep only last 1000 durations per endpoint to avoid memory bloat
        if len(_request_durations_ms[key]) > 1000:
            _request_durations_ms[key] = _request_durations_ms[key][-1000:]


def record_ml_training(dataset_id: str, tenant_id: str | None, model: str, duration_ms: float):
    """Record ML training metrics."""
    key = f"{model}:{dataset_id}"
    with _metrics_lock:
        _ml_training_times_ms[key].append(duration_ms)
        if len(_ml_training_times_ms[key]) > 1000:
            _ml_training_times_ms[key] = _ml_training_times_ms[key][-1000:]


def record_dataset_upload(dataset_id: str, tenant_id: str | None, row_count: int):
    """Record dataset size metrics."""
    key = f"{tenant_id}:{dataset_id}"
    with _metrics_lock:
        _dataset_sizes[key] = row_count


def record_cache_hit(cache_key: str, tenant_id: str | None):
    """Record cache hit."""
    key = f"{tenant_id}:{cache_key}"
    with _metrics_lock:
        _cache_hits[key] += 1


def record_cache_miss(cache_key: str, tenant_id: str | None):
    """Record cache miss."""
    key = f"{tenant_id}:{cache_key}"
    with _metrics_lock:
        _cache_misses[key] += 1


def get_metrics_summary() -> Dict[str, Any]:
    """Return a summary of all metrics."""
    with _metrics_lock:
        # Request metrics
        request_summary = {}
        for endpoint in _request_counts:
            durations = _request_durations_ms[endpoint]
            request_summary[endpoint] = {
                "request_count": _request_counts[endpoint],
                "error_count": _error_counts[endpoint],
                "error_rate": _error_counts[endpoint] / max(1, _request_counts[endpoint]),
                "avg_duration_ms": sum(durations) / len(durations) if durations else 0,
                "max_duration_ms": max(durations) if durations else 0,
                "p95_duration_ms": sorted(durations)[int(len(durations) * 0.95)] if len(durations) > 20 else 0,
            }
        # ML training metrics
        ml_summary = {}
        for key, times in _ml_training_times_ms.items():
            ml_summary[key] = {
                "count": len(times),
                "avg_duration_ms": sum(times) / len(times) if times else 0,
                "max_duration_ms": max(times) if times else 0,
            }
        # Dataset size metrics
        dataset_summary = {}
        for key, size in _dataset_sizes.items():
            dataset_summary[key] = {"row_count": size}
        # Cache metrics
        cache_summary = {}
        for key in set(list(_cache_hits.keys()) + list(_cache_misses.keys())):
            hits = _cache_hits.get(key, 0)
            misses = _cache_misses.get(key, 0)
            total = hits + misses
            cache_summary[key] = {
                "hits": hits,
                "misses": misses,
                "hit_rate": hits / max(1, total),
            }
        return {
            "timestamp": time.time(),
            "requests": request_summary,
            "ml_training": ml_summary,
            "datasets": dataset_summary,
            "cache": cache_summary,
        }


def reset_metrics():
    """Reset all metrics (for testing or manual reset)."""
    with _metrics_lock:
        _request_counts.clear()
        _request_durations_ms.clear()
        _error_counts.clear()
        _ml_training_times_ms.clear()
        _dataset_sizes.clear()
        _cache_hits.clear()
        _cache_misses.clear()
