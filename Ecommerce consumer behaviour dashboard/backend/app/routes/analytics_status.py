from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from app.models.schemas import ApiResponse
from app.services.analytics_status import get_status
from app.services.storage_service import get_dataset, get_tenant_id


router = APIRouter(tags=["analytics"], prefix="/analytics")


@router.get("/status/{dataset_id}", response_model=ApiResponse)
def analytics_status(request: Request, dataset_id: str) -> ApiResponse:
    tenant_id = get_tenant_id(request)
    try:
        ds = get_dataset(dataset_id, tenant_id=tenant_id)
        if not ds:
            raise HTTPException(status_code=404, detail="Dataset not found")
    except HTTPException as exc:
        raise exc

    status = get_status(dataset_id) or {"status": "pending", "available_modules": []}
    return ApiResponse(data=status)
