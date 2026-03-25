from __future__ import annotations

import threading
import time
from typing import Any

from app.services.logging_service import log_cache_hit, log_cache_miss
from app.services.metrics_service import record_cache_hit, record_cache_miss

_cache: dict[str, tuple[float, Any]] = {}
_lock = threading.Lock()


def get_cache(key: str, tenant_id: str | None = None):
    now = time.monotonic()
    with _lock:
        item = _cache.get(key)
        if not item:
            log_cache_miss(key, tenant_id)
            record_cache_miss(key, tenant_id)
            return None
        expires_at, value = item
        if expires_at < now:
            _cache.pop(key, None)
            log_cache_miss(key, tenant_id)
            record_cache_miss(key, tenant_id)
            return None
        log_cache_hit(key, tenant_id)
        record_cache_hit(key, tenant_id)
        return value


def set_cache(key: str, value, ttl: int, tenant_id: str | None = None) -> None:
    expires_at = time.monotonic() + max(0, int(ttl))
    with _lock:
        _cache[key] = (expires_at, value)


def clear_cache(pattern: str | None = None, tenant_id: str | None = None) -> int:
    """Clear cache entries matching pattern and/or tenant_id."""
    now = time.monotonic()
    keys_to_remove = []
    
    with _lock:
        for key, (expires_at, _) in _cache.items():
            # Skip expired entries
            if expires_at < now:
                keys_to_remove.append(key)
                continue
            
            # Check pattern match
            if pattern and pattern not in key:
                continue
            
            # Check tenant match (for tenant-specific cache keys)
            if tenant_id and f"tenant_{tenant_id}" not in key:
                continue
            
            keys_to_remove.append(key)
        
        for key in keys_to_remove:
            _cache.pop(key, None)
    
    return len(keys_to_remove)


def clear_dataset_cache(dataset_id: str, version_id: str | None = None, tenant_id: str | None = None) -> int:
    """Clear all cache entries for a specific dataset."""
    pattern = f"{dataset_id}"
    if version_id:
        pattern = f"{dataset_id}_v{version_id}"
    return clear_cache(pattern, tenant_id)


def clear_tenant_cache(tenant_id: str) -> int:
    """Clear all cache entries for a tenant."""
    return clear_cache(None, tenant_id)


def get_cache_stats() -> dict[str, int]:
    """Get cache statistics."""
    now = time.monotonic()
    total = 0
    expired = 0
    
    with _lock:
        for key, (expires_at, _) in _cache.items():
            total += 1
            if expires_at < now:
                expired += 1
    
    return {
        "total_entries": total,
        "expired_entries": expired,
        "active_entries": total - expired,
    }
