from __future__ import annotations

import time
from functools import wraps
from typing import Any, Callable, TypeVar

F = TypeVar("F", bound=Callable[..., Any])

def retry_on_failure(
    max_attempts: int = 3,
    initial_delay: float = 0.5,
    backoff_factor: float = 2.0,
    exceptions: tuple[type[Exception], ...] = (Exception,),
):
    """
    Decorator to retry a function on failure with exponential backoff.
    """
    def decorator(func: F) -> F:
        @wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            attempt = 0
            delay = initial_delay
            last_exception = None
            while attempt < max_attempts:
                try:
                    return func(*args, **kwargs)
                except exceptions as exc:
                    attempt += 1
                    last_exception = exc
                    if attempt >= max_attempts:
                        break
                    time.sleep(delay)
                    delay *= backoff_factor
            # Re-raise the last exception after all attempts
            raise last_exception  # type: ignore
        return wrapper  # type: ignore
    return decorator
