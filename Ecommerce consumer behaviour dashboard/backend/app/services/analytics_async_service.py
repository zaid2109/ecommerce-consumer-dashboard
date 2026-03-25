from __future__ import annotations

from fastapi import BackgroundTasks

from app.services.analytics_service import get_anomalies, get_segmentation
from app.services.analytics_status import init_pending, set_status
from app.services.storage_service import get_dataset
from app.services.logging_service import log_background_task, log_cache_hit, log_cache_miss
from app.services.retry_service import retry_on_failure


def _default_filters() -> dict[str, object]:
    return {
        "from_date": None,
        "to_date": None,
        "category": None,
        "payment_method": None,
        "granularity": "day",
        "top": 20,
        "include_ml": True,
    }


@retry_on_failure(max_attempts=3, initial_delay=0.5, backoff_factor=2.0)
def _run_segmentation(dataset_id: str, filters: dict[str, object], tenant_id: str | None) -> bool:
    """Run segmentation with retries; returns True if successful."""
    seg = get_segmentation(dataset_id, filters, tenant_id=tenant_id)
    return seg and seg.get("status") == "ok"

# @retry_on_failure(max_attempts=3, initial_delay=0.5, backoff_factor=2.0)
# def _run_clv(dataset_id: str, filters: dict[str, object], tenant_id: str | None) -> bool:
#     """Run CLV with retries; returns True if successful."""
#     clv = get_clv(dataset_id, filters, tenant_id=tenant_id)
#     return clv and clv.get("status") == "ok"

@retry_on_failure(max_attempts=3, initial_delay=0.5, backoff_factor=2.0)
def _run_anomalies(dataset_id: str, filters: dict[str, object], tenant_id: str | None) -> bool:
    """Run anomalies with retries; returns True if successful."""
    anom = get_anomalies(dataset_id, filters, tenant_id=tenant_id)
    return anom and anom.get("status") == "ok"


def precompute_analytics(dataset_id: str) -> None:
    # Resolve tenant_id from dataset metadata (since we don't have request context in background)
    dataset = get_dataset(dataset_id)
    tenant_id = dataset.get("tenant_id") if isinstance(dataset, dict) else None
    log_background_task("precompute_analytics", dataset_id, tenant_id)

    set_status(dataset_id, "processing", [])

    filters = _default_filters()
    available: list[str] = []

    # Run each module independently; failures don't stop others
    modules_to_run = [
        ("segmentation", _run_segmentation),
        # ("clv", _run_clv),
        ("anomalies", _run_anomalies),
    ]

    for name, runner in modules_to_run:
        try:
            if runner(dataset_id, filters, tenant_id=tenant_id):
                available.append(name)
                log_background_task(f"precompute_analytics:{name}", dataset_id, tenant_id)
            else:
                log_background_task(f"precompute_analytics:{name}", dataset_id, tenant_id, Exception(f"Module {name} returned non-ok status"))
        except Exception as exc:
            log_background_task(f"precompute_analytics:{name}", dataset_id, tenant_id, exc)

    set_status(dataset_id, "completed", available)
    log_background_task("precompute_analytics", dataset_id, tenant_id)


def enqueue_precompute(background_tasks: BackgroundTasks, dataset_id: str) -> None:
    init_pending(dataset_id)
    background_tasks.add_task(precompute_analytics, dataset_id)
