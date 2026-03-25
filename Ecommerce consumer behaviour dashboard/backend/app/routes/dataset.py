from __future__ import annotations

from fastapi import APIRouter, Query, Request, HTTPException

from app.models.schemas import ApiResponse
from app.services.analytics_service import get_dashboard
from app.services.enhanced_rfm_service import get_enhanced_rfm_data
from app.services.payment_analysis_service import get_payment_analysis_data
from app.services.returns_analysis_service import get_returns_analysis_data
from app.services.storage_service import get_tenant_id

router = APIRouter(tags=["dataset"])


@router.get("/dataset/{dataset_id}/dashboard", response_model=ApiResponse)
def dataset_dashboard(
    request: Request,
    dataset_id: str,
    from_date: str | None = Query(None),
    to_date: str | None = Query(None),
    category: str | None = Query(None),
    payment_method: str | None = Query(None),
    granularity: str = Query("day"),
    top: int = Query(20),
    include_ml: bool = Query(False),
) -> ApiResponse:
    """Get dashboard data for a specific dataset - matches frontend expectation"""
    tenant_id = get_tenant_id(request)
    
    # Build filters similar to analytics router
    filters = {}
    if from_date:
        filters["from_date"] = from_date
    if to_date:
        filters["to_date"] = to_date
    if category:
        filters["category"] = category
    if payment_method:
        filters["payment_method"] = payment_method
    filters["granularity"] = granularity
    filters["top"] = top
    filters["include_ml"] = include_ml
    
    try:
        result = get_dashboard(dataset_id, filters, tenant_id=tenant_id)
        if result is None:
            raise HTTPException(status_code=404, detail="Dataset not found")
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dataset/{dataset_id}/enhanced-rfm", response_model=ApiResponse)
def dataset_enhanced_rfm(
    request: Request,
    dataset_id: str,
    from_date: str | None = Query(None),
    to_date: str | None = Query(None),
    category: str | None = Query(None),
    payment_method: str | None = Query(None),
) -> ApiResponse:
    """Get enhanced RFM segmentation for a specific dataset - matches frontend expectation"""
    tenant_id = get_tenant_id(request)
    
    # Build filters similar to analytics router
    filters = {}
    if from_date:
        filters["from_date"] = from_date
    if to_date:
        filters["to_date"] = to_date
    if category:
        filters["category"] = category
    if payment_method:
        filters["payment_method"] = payment_method
    
    try:
        result = get_enhanced_rfm_data(dataset_id, filters, tenant_id=tenant_id)
        if result is None:
            raise HTTPException(status_code=404, detail="Dataset not found")
        return ApiResponse(data=result)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dataset/{dataset_id}/payment-analysis", response_model=ApiResponse)
def dataset_payment_analysis(
    request: Request,
    dataset_id: str,
    from_date: str | None = Query(None),
    to_date: str | None = Query(None),
    category: str | None = Query(None),
    payment_method: str | None = Query(None),
) -> ApiResponse:
    """Get payment analysis for a specific dataset - matches frontend expectation"""
    tenant_id = get_tenant_id(request)
    
    # Build filters similar to analytics router
    filters = {}
    if from_date:
        filters["from_date"] = from_date
    if to_date:
        filters["to_date"] = to_date
    if category:
        filters["category"] = category
    if payment_method:
        filters["payment_method"] = payment_method
    
    try:
        result = get_payment_analysis_data(dataset_id, filters, tenant_id=tenant_id)
        
        if result.get("status") == "unavailable":
            return ApiResponse(data={"status": "unavailable", "reason": result.get("reason")})
        elif result.get("status") == "error":
            raise HTTPException(status_code=500, detail=result.get("error"))
        else:
            return ApiResponse(data=result.get("data"))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dataset/{dataset_id}/returns-analysis", response_model=ApiResponse)
def dataset_returns_analysis(
    request: Request,
    dataset_id: str,
    from_date: str | None = Query(None),
    to_date: str | None = Query(None),
    category: str | None = Query(None),
    payment_method: str | None = Query(None),
) -> ApiResponse:
    """Get returns analysis for a specific dataset - matches frontend expectation"""
    tenant_id = get_tenant_id(request)
    
    # Build filters similar to analytics router
    filters = {}
    if from_date:
        filters["from_date"] = from_date
    if to_date:
        filters["to_date"] = to_date
    if category:
        filters["category"] = category
    if payment_method:
        filters["payment_method"] = payment_method
    
    try:
        result = get_returns_analysis_data(dataset_id, filters, tenant_id=tenant_id)
        
        if result.get("status") == "unavailable":
            return ApiResponse(data={"status": "unavailable", "reason": result.get("reason")})
        elif result.get("status") == "error":
            raise HTTPException(status_code=500, detail=result.get("error"))
        else:
            return ApiResponse(data=result.get("data"))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
