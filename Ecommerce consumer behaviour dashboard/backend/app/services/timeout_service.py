from __future__ import annotations

import signal
from contextlib import contextmanager
from typing import Any, Callable, TypeVar

F = TypeVar("F", bound=Callable[..., Any])

class TimeoutError(Exception):
    """Raised when a function times out."""

def timeout(seconds: float):
    """Decorator to add a timeout to a function."""
    def decorator(func: F) -> F:
        def wrapper(*args, **kwargs) -> Any:
            def _handle_timeout(signum, frame):
                raise TimeoutError(f"Function timed out after {seconds} seconds")
            old_handler = signal.signal(signal.SIGALRM, _handle_timeout)
            signal.alarm(int(seconds))
            try:
                result = func(*args, **kwargs)
            finally:
                signal.alarm(0)
                signal.signal(signal.SIGALRM, old_handler)
            return result
        return wrapper  # type: ignore
    return decorator

@contextmanager
def request_timeout(seconds: float = 30.0):
    """Context manager to enforce a timeout for a block of code."""
    def _handle_timeout(signum, frame):
        raise TimeoutError(f"Request timed out after {seconds} seconds")
    old_handler = signal.signal(signal.SIGALRM, _handle_timeout)
    signal.alarm(int(seconds))
    try:
        yield
    finally:
        signal.alarm(0)
        signal.signal(signal.SIGALRM, old_handler)
