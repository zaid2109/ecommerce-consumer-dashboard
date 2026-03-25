from __future__ import annotations

from fastapi import APIRouter, Request

from app.models.schemas import ApiResponse
from app.services.metrics_service import get_metrics_summary, reset_metrics
from app.services.circuit_breaker_service import reset_all_breakers
from app.services.storage_service import get_tenant_id

router = APIRouter(tags=["metrics"])


@router.get("/metrics", response_model=ApiResponse)
def metrics(request: Request) -> ApiResponse:
    """Expose current metrics summary."""
    tenant_id = get_tenant_id(request)
    # In a multi-tenant system, you might filter metrics by tenant_id here
    # For now, return global metrics
    return ApiResponse(data=get_metrics_summary())


@router.post("/metrics/reset", response_model=ApiResponse)
def reset_metrics_route(request: Request) -> ApiResponse:
    """Reset all metrics and circuit breakers (admin only, tenant-scoped in production)."""
    tenant_id = get_tenant_id(request)
    # In production, add admin check or tenant-scoped reset
    reset_metrics()
    reset_all_breakers()
    return ApiResponse(data={"message": "Metrics and circuit breakers reset"})
