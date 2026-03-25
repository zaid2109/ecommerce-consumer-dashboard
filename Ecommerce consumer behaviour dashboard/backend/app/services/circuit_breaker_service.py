from __future__ import annotations

import time
from threading import Lock
from typing import Any, Callable, TypeVar

F = TypeVar("F", bound=Callable[..., Any])

class CircuitBreaker:
    """Simple circuit breaker with failure threshold and timeout."""

    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: float = 60.0,
        expected_exception: type[Exception] = Exception,
    ):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.expected_exception = expected_exception
        self.failure_count = 0
        self.last_failure_time = None
        self.state = "closed"  # closed, open, half_open
        self._lock = Lock()

    def call(self, func: F, *args, **kwargs) -> Any:
        """Call a function through the circuit breaker."""
        with self._lock:
            if self.state == "open":
                if time.time() - (self.last_failure_time or 0) >= self.recovery_timeout:
                    self.state = "half_open"
                else:
                    raise self.expected_exception("Circuit breaker is open")
        try:
            result = func(*args, **kwargs)
            # Success: reset failure count and close circuit
            with self._lock:
                self.failure_count = 0
                self.state = "closed"
            return result
        except self.expected_exception as exc:
            with self._lock:
                self.failure_count += 1
                self.last_failure_time = time.time()
                if self.failure_count >= self.failure_threshold:
                    self.state = "open"
            raise

# Per-module circuit breakers
_module_breakers: dict[str, CircuitBreaker] = {}
_breakers_lock = Lock()

def get_module_breaker(module_name: str) -> CircuitBreaker:
    """Get or create a circuit breaker for a module."""
    with _breakers_lock:
        if module_name not in _module_breakers:
            _module_breakers[module_name] = CircuitBreaker(
                failure_threshold=5,
                recovery_timeout=60.0,
                expected_exception=Exception,
            )
        return _module_breakers[module_name]

def reset_all_breakers():
    """Reset all circuit breakers (for testing)."""
    with _breakers_lock:
        for breaker in _module_breakers.values():
            breaker.failure_count = 0
            breaker.state = "closed"
