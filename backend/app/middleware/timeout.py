import asyncio
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

class RequestTimeoutMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        try:
            # Set a 30-second timeout for the request handling
            response = await asyncio.wait_for(call_next(request), timeout=30)
            return response
        except asyncio.TimeoutError:
            # Return a 408 status code on timeout
            return Response(content="Request Timeout", status_code=408)