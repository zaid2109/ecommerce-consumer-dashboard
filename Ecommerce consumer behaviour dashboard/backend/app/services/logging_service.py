from __future__ import annotations

import json
import logging
import time
import uuid
from contextlib import contextmanager
from typing import Any, Callable

from app.services.storage_service import get_tenant_id

# Configure JSON logger
logger = logging.getLogger("structured")
handler = logging.StreamHandler()
formatter = logging.Formatter("%(message)s")
handler.setFormatter(formatter)
logger.addHandler(handler)
logger.setLevel(logging.INFO)


@contextmanager
def log_request(request, endpoint: str):
    """Context manager to log request start/end with structured JSON."""
    request_id = str(uuid.uuid4())
    tenant_id = get_tenant_id(request) or "anonymous"
    start = time.monotonic()
    # Log request start
    logger.info(json.dumps({
        "event": "request_start",
        "request_id": request_id,
        "user_id": tenant_id,
        "endpoint": endpoint,
        "method": request.method,
        "path": request.url.path,
        "timestamp": time.time(),
    }))
    try:
        yield request_id
    except Exception as exc:
        duration_ms = (time.monotonic() - start) * 1000
        logger.info(json.dumps({
            "event": "request_error",
            "request_id": request_id,
            "user_id": tenant_id,
            "endpoint": endpoint,
            "error": str(exc),
            "error_type": type(exc).__name__,
            "duration_ms": round(duration_ms, 2),
            "timestamp": time.time(),
        }))
        raise
    else:
        duration_ms = (time.monotonic() - start) * 1000
        logger.info(json.dumps({
            "event": "request_success",
            "request_id": request_id,
            "user_id": tenant_id,
            "endpoint": endpoint,
            "duration_ms": round(duration_ms, 2),
            "timestamp": time.time(),
        }))


def log_background_task(task_name: str, dataset_id: str | None, tenant_id: str | None, error: Exception | None = None):
    """Log background task events."""
    event = "task_error" if error else "task_start" if not dataset_id else "task_complete"
    payload = {
        "event": event,
        "task": task_name,
        "dataset_id": dataset_id,
        "user_id": tenant_id or "anonymous",
        "timestamp": time.time(),
    }
    if error:
        payload["error"] = str(error)
        payload["error_type"] = type(error).__name__
    logger.info(json.dumps(payload))


def log_cache_hit(cache_key: str, tenant_id: str | None):
    """Log cache hits."""
    logger.info(json.dumps({
        "event": "cache_hit",
        "cache_key": cache_key,
        "user_id": tenant_id or "anonymous",
        "timestamp": time.time(),
    }))


def log_cache_miss(cache_key: str, tenant_id: str | None):
    """Log cache misses."""
    logger.info(json.dumps({
        "event": "cache_miss",
        "cache_key": cache_key,
        "user_id": tenant_id or "anonymous",
        "timestamp": time.time(),
    }))


def log_ml_start(dataset_id: str, tenant_id: str | None, model: str):
    """Log ML model training start."""
    logger.info(json.dumps({
        "event": "ml_start",
        "dataset_id": dataset_id,
        "user_id": tenant_id or "anonymous",
        "model": model,
        "timestamp": time.time(),
    }))


def log_ml_complete(dataset_id: str, tenant_id: str | None, model: str, duration_ms: float):
    """Log ML model training completion."""
    logger.info(json.dumps({
        "event": "ml_complete",
        "dataset_id": dataset_id,
        "user_id": tenant_id or "anonymous",
        "model": model,
        "duration_ms": round(duration_ms, 2),
        "timestamp": time.time(),
    }))


def log_ml_error(dataset_id: str, tenant_id: str | None, model: str, error: Exception):
    """Log ML model training error."""
    logger.info(json.dumps({
        "event": "ml_error",
        "dataset_id": dataset_id,
        "user_id": tenant_id or "anonymous",
        "model": model,
        "error": str(error),
        "error_type": type(error).__name__,
        "timestamp": time.time(),
    }))


def with_logging(endpoint: str):
    """Decorator to add structured logging to FastAPI route handlers."""
    def decorator(func: Callable) -> Callable:
        def wrapper(request, *args, **kwargs):
            with log_request(request, endpoint):
                return func(request, *args, **kwargs)
        return wrapper
    return decorator
