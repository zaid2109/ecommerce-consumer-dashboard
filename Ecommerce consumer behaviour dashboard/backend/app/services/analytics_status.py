from __future__ import annotations

import threading


_status: dict[str, dict[str, object]] = {}
_lock = threading.Lock()


def set_status(dataset_id: str, status: str, available_modules: list[str] | None = None) -> None:
    payload: dict[str, object] = {"status": status}
    if available_modules is not None:
        payload["available_modules"] = list(available_modules)
    with _lock:
        _status[dataset_id] = payload


def get_status(dataset_id: str) -> dict[str, object] | None:
    with _lock:
        value = _status.get(dataset_id)
        return dict(value) if isinstance(value, dict) else None


def init_pending(dataset_id: str) -> None:
    existing = get_status(dataset_id)
    if existing is not None:
        return
    set_status(dataset_id, "pending", [])
