from __future__ import annotations

import json
import logging
import time
import uuid
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.services.storage_service import get_tenant_id
from app.services.metrics_service import record_request

# Configure JSON logger
logger = logging.getLogger("structured")
handler = logging.StreamHandler()
formatter = logging.Formatter("%(message)s")
handler.setFormatter(formatter)
logger.addHandler(handler)
logger.setLevel(logging.INFO)


class StructuredLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware to log all HTTP requests/responses with structured JSON."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        request_id = str(uuid.uuid4())
        tenant_id = get_tenant_id(request) or "anonymous"
        start = time.monotonic()
        # Store request_id for downstream use
        request.state.request_id = request_id

        # Log request start
        logger.info(json.dumps({
            "event": "request_start",
            "request_id": request_id,
            "user_id": tenant_id,
            "method": request.method,
            "path": request.url.path,
            "query": str(request.query_params) if request.query_params else None,
            "timestamp": time.time(),
        }))

        try:
            response = await call_next(request)
            duration_ms = (time.monotonic() - start) * 1000
            # Record metrics
            record_request(
                endpoint=request.url.path,
                method=request.method,
                status_code=response.status_code,
                duration_ms=duration_ms,
                tenant_id=tenant_id,
            )
            # Log request success
            logger.info(json.dumps({
                "event": "request_success",
                "request_id": request_id,
                "user_id": tenant_id,
                "status_code": response.status_code,
                "duration_ms": round(duration_ms, 2),
                "timestamp": time.time(),
            }))
            return response
        except Exception as exc:
            duration_ms = (time.monotonic() - start) * 1000
            # Record metrics for errors
            record_request(
                endpoint=request.url.path,
                method=request.method,
                status_code=500,
                duration_ms=duration_ms,
                tenant_id=tenant_id,
            )
            # Log request error
            logger.info(json.dumps({
                "event": "request_error",
                "request_id": request_id,
                "user_id": tenant_id,
                "error": str(exc),
                "error_type": type(exc).__name__,
                "duration_ms": round(duration_ms, 2),
                "timestamp": time.time(),
            }))
            raise
