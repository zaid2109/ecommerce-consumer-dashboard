from __future__ import annotations

import signal
import platform
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.services.timeout_service import TimeoutError, request_timeout

class RequestTimeoutMiddleware(BaseHTTPMiddleware):
    """Middleware to enforce a global timeout on all requests."""

    def __init__(self, app, timeout_seconds: float = 30.0):
        super().__init__(app)
        self.timeout_seconds = timeout_seconds

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Skip timeout middleware on Windows as SIGALRM is not available
        if platform.system() == "Windows":
            return await call_next(request)
            
        def _handle_timeout(signum, frame):
            raise TimeoutError(f"Request timed out after {self.timeout_seconds} seconds")
        old_handler = signal.signal(signal.SIGALRM, _handle_timeout)
        signal.alarm(int(self.timeout_seconds))
        try:
            response = await call_next(request)
            return response
        finally:
            signal.alarm(0)
            signal.signal(signal.SIGALRM, old_handler)
