from __future__ import annotations

from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        # X-Forwarded-For may include multiple comma-separated IPs; use the left-most.
        ip = forwarded.split(",", 1)[0].strip()
        if ip:
            return ip
    return get_remote_address(request)


limiter = Limiter(key_func=_client_ip, headers_enabled=True)
