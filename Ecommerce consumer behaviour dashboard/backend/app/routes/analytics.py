from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Request

from app.models.schemas import ApiResponse
from app.services.analytics_service import (
    get_anomalies,
    get_customer_segmentation,
    get_dashboard,
    get_metrics,
    get_payment_analysis,
    get_profile,
    get_purchase_frequency,
    get_recommendations,
    get_revenue_by_category,
    get_returns,
    get_schema,
    get_segmentation,
    get_table,
    get_time_series,
)
from app.services.enhanced_rfm_service import get_enhanced_rfm_data
from app.services.payment_analysis_service import get_payment_analysis_data
from app.services.returns_analysis_service import get_returns_analysis_data
from app.services.storage_service import delete_dataset, list_datasets, get_tenant_id, list_dataset_versions, get_dataset

router = APIRouter(tags=["analytics"])


def _filters(
    from_date: str | None,
    to_date: str | None,
    category: str | None,
    payment_method: str | None,
    granularity: str,
    top: int,
    include_ml: bool = False,
) -> dict[str, str | int | None]:
    return {
        "from_date": from_date,
        "to_date": to_date,
        "category": category,
        "payment_method": payment_method,
        "granularity": granularity,
        "top": top,
        "include_ml": include_ml,
    }


def _or_404(payload):
    if payload is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return ApiResponse(data=payload)


@router.get("/datasets", response_model=ApiResponse)
def datasets(request: Request) -> ApiResponse:
    tenant_id = get_tenant_id(request)
    return ApiResponse(data=list_datasets(tenant_id=tenant_id))


@router.get("/schema", response_model=ApiResponse)
def schema(request: Request, dataset_id: str = Query(...)) -> ApiResponse:
    tenant_id = get_tenant_id(request)
    try:
        return _or_404(get_schema(dataset_id, tenant_id=tenant_id))
    except HTTPException as exc:
        raise exc


@router.get("/profile", response_model=ApiResponse)
def profile(request: Request, dataset_id: str = Query(...)) -> ApiResponse:
    tenant_id = get_tenant_id(request)
    try:
        return _or_404(get_profile(dataset_id, tenant_id=tenant_id))
    except HTTPException as exc:
        raise exc


@router.get("/dashboard", response_model=ApiResponse)
def dashboard(
    request: Request,
    dataset_id: str = Query(...),
    from_date: str | None = Query(None),
    to_date: str | None = Query(None),
    category: str | None = Query(None),
    payment_method: str | None = Query(None),
    granularity: str = Query("day"),
    top: int = Query(20),
    include_ml: bool = Query(False),
) -> ApiResponse:
    tenant_id = get_tenant_id(request)
    try:
        return _or_404(
            get_dashboard(
                dataset_id,
                _filters(from_date, to_date, category, payment_method, granularity, top, include_ml),
                tenant_id=tenant_id,
            )
        )
    except HTTPException as exc:
        raise exc


@router.get("/table", response_model=ApiResponse)
def table(
    request: Request,
    dataset_id: str = Query(...),
    page: int = Query(1, ge=1),
    limit: int = Query(80, ge=1, le=200),
    from_date: str | None = Query(None),
    to_date: str | None = Query(None),
    category: str | None = Query(None),
    payment_method: str | None = Query(None),
) -> ApiResponse:
    tenant_id = get_tenant_id(request)
    try:
        return _or_404(get_table(dataset_id, page, limit, _filters(from_date, to_date, category, payment_method, "day", 20), tenant_id=tenant_id))
    except HTTPException as exc:
        raise exc


@router.get("/metrics", response_model=ApiResponse)
def metrics(
    request: Request,
    dataset_id: str = Query(...),
    from_date: str | None = Query(None),
    to_date: str | None = Query(None),
    category: str | None = Query(None),
    payment_method: str | None = Query(None),
) -> ApiResponse:
    tenant_id = get_tenant_id(request)
    try:
        return _or_404(get_metrics(dataset_id, _filters(from_date, to_date, category, payment_method, "day", 20), tenant_id=tenant_id))
    except HTTPException as exc:
        raise exc


@router.get("/revenue-by-category", response_model=ApiResponse)
def revenue_by_category(
    request: Request,
    dataset_id: str = Query(...),
    from_date: str | None = Query(None),
    to_date: str | None = Query(None),
    category: str | None = Query(None),
    payment_method: str | None = Query(None),
    top: int = Query(20),
) -> ApiResponse:
    tenant_id = get_tenant_id(request)
    try:
        return _or_404(get_revenue_by_category(dataset_id, _filters(from_date, to_date, category, payment_method, "day", top), top, tenant_id=tenant_id))
    except HTTPException as exc:
        raise exc


@router.get("/time-series", response_model=ApiResponse)
def time_series(
    request: Request,
    dataset_id: str = Query(...),
    from_date: str | None = Query(None),
    to_date: str | None = Query(None),
    category: str | None = Query(None),
    payment_method: str | None = Query(None),
    granularity: str = Query("day"),
) -> ApiResponse:
    tenant_id = get_tenant_id(request)
    try:
        return _or_404(get_time_series(dataset_id, _filters(from_date, to_date, category, payment_method, granularity, 20), tenant_id=tenant_id))
    except HTTPException as exc:
        raise exc


@router.get("/purchase-frequency", response_model=ApiResponse)
def purchase_frequency(
    request: Request,
    dataset_id: str = Query(...),
    from_date: str | None = Query(None),
    to_date: str | None = Query(None),
    category: str | None = Query(None),
    payment_method: str | None = Query(None),
) -> ApiResponse:
    tenant_id = get_tenant_id(request)
    try:
        return _or_404(get_purchase_frequency(dataset_id, _filters(from_date, to_date, category, payment_method, "day", 20), tenant_id=tenant_id))
    except HTTPException as exc:
        raise exc


@router.get("/payment-analysis", response_model=ApiResponse)
def payment_analysis(
    request: Request,
    dataset_id: str = Query(...),
    from_date: str | None = Query(None),
    to_date: str | None = Query(None),
    category: str | None = Query(None),
    payment_method: str | None = Query(None),
) -> ApiResponse:
    tenant_id = get_tenant_id(request)
    try:
        return _or_404(get_payment_analysis(dataset_id, _filters(from_date, to_date, category, payment_method, "day", 20), tenant_id=tenant_id))
    except HTTPException as exc:
        raise exc


@router.get("/returns", response_model=ApiResponse)
def returns(
    request: Request,
    dataset_id: str = Query(...),
    from_date: str | None = Query(None),
    to_date: str | None = Query(None),
    category: str | None = Query(None),
    payment_method: str | None = Query(None),
) -> ApiResponse:
    tenant_id = get_tenant_id(request)
    try:
        return _or_404(get_returns(dataset_id, _filters(from_date, to_date, category, payment_method, "day", 20), tenant_id=tenant_id))
    except HTTPException as exc:
        raise exc


@router.get("/enhanced-rfm", response_model=ApiResponse)
def enhanced_rfm(
    request: Request,
    dataset_id: str = Query(...),
    from_date: str | None = Query(None),
    to_date: str | None = Query(None),
    category: str | None = Query(None),
    payment_method: str | None = Query(None),
) -> ApiResponse:
    """Get enhanced RFM segmentation with advanced business insights"""
    tenant_id = get_tenant_id(request)
    try:
        filters = _filters(from_date, to_date, category, payment_method, "day", 20)
        result = get_enhanced_rfm_data(dataset_id, filters, tenant_id=tenant_id)
        return ApiResponse(data=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/payment-analysis", response_model=ApiResponse)
def payment_analysis(
    request: Request,
    dataset_id: str = Query(...),
    from_date: str | None = Query(None),
    to_date: str | None = Query(None),
    category: str | None = Query(None),
    payment_method: str | None = Query(None),
) -> ApiResponse:
    """Get comprehensive payment analysis data"""
    tenant_id = get_tenant_id(request)
    try:
        filters = _filters(from_date, to_date, category, payment_method, "day", 20)
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


@router.get("/returns-analysis", response_model=ApiResponse)
def returns_analysis(
    request: Request,
    dataset_id: str = Query(...),
    from_date: str | None = Query(None),
    to_date: str | None = Query(None),
    category: str | None = Query(None),
    payment_method: str | None = Query(None),
) -> ApiResponse:
    """Get comprehensive returns analysis data"""
    tenant_id = get_tenant_id(request)
    try:
        filters = _filters(from_date, to_date, category, payment_method, "day", 20)
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


@router.get("/segmentation", response_model=ApiResponse)
def segmentation(
    request: Request,
    dataset_id: str = Query(...),
    from_date: str | None = Query(None),
    to_date: str | None = Query(None),
    category: str | None = Query(None),
    payment_method: str | None = Query(None),
) -> ApiResponse:
    tenant_id = get_tenant_id(request)
    try:
        return _or_404(get_segmentation(dataset_id, _filters(from_date, to_date, category, payment_method, "day", 20), tenant_id=tenant_id))
    except HTTPException as exc:
        raise exc


# @router.get("/clv", response_model=ApiResponse)
# def clv(
#     request: Request,
#     dataset_id: str = Query(...),
#     from_date: str | None = Query(None),
#     to_date: str | None = Query(None),
#     category: str | None = Query(None),
#     payment_method: str | None = Query(None),
# ) -> ApiResponse:
#     tenant_id = get_tenant_id(request)
#     try:
#         return _or_404(get_clv(dataset_id, _filters(from_date, to_date, category, payment_method, "day", 20), tenant_id=tenant_id))
#     except HTTPException as exc:
#         raise exc


@router.get("/recommendations", response_model=ApiResponse)
def recommendations(
    request: Request,
    dataset_id: str = Query(...),
    from_date: str | None = Query(None),
    to_date: str | None = Query(None),
    category: str | None = Query(None),
    payment_method: str | None = Query(None),
) -> ApiResponse:
    tenant_id = get_tenant_id(request)
    try:
        return _or_404(get_recommendations(dataset_id, _filters(from_date, to_date, category, payment_method, "day", 20), tenant_id=tenant_id))
    except HTTPException as exc:
        raise exc


@router.get("/anomalies", response_model=ApiResponse)
def anomalies(
    request: Request,
    dataset_id: str = Query(...),
    from_date: str | None = Query(None),
    to_date: str | None = Query(None),
    category: str | None = Query(None),
    payment_method: str | None = Query(None),
) -> ApiResponse:
    tenant_id = get_tenant_id(request)
    try:
        return _or_404(get_anomalies(dataset_id, _filters(from_date, to_date, category, payment_method, "day", 20), tenant_id=tenant_id))
    except HTTPException as exc:
        raise exc


@router.get("/datasets/{dataset_id}/versions", response_model=ApiResponse)
def dataset_versions(request: Request, dataset_id: str) -> ApiResponse:
    tenant_id = get_tenant_id(request)
    try:
        versions = list_dataset_versions(dataset_id, tenant_id=tenant_id)
        if not versions:
            raise HTTPException(status_code=404, detail="Dataset not found")
        return ApiResponse(data=versions)
    except HTTPException as exc:
        raise exc


@router.get("/datasets/{dataset_id}/versions/{version_id}", response_model=ApiResponse)
def dataset_version_detail(request: Request, dataset_id: str, version_id: str) -> ApiResponse:
    tenant_id = get_tenant_id(request)
    try:
        dataset = get_dataset(dataset_id, version_id=version_id, tenant_id=tenant_id)
        if not dataset:
            raise HTTPException(status_code=404, detail="Dataset version not found")
        return ApiResponse(data={
            "dataset_id": dataset["dataset_id"],
            "version_id": dataset["version_id"],
            "created_at": dataset["created_at"],
            "source_file_name": dataset["source_file_name"],
            "row_count": dataset["row_count"],
            "columns": dataset["columns"],
            "schema": dataset["schema"],
            "roles": dataset["roles"],
            "profile": dataset["profile"],
            "modules": dataset["modules"],
        })
    except HTTPException as exc:
        raise exc


@router.delete("/datasets/{dataset_id}", response_model=ApiResponse)
def delete_dataset_route(request: Request, dataset_id: str) -> ApiResponse:
    tenant_id = get_tenant_id(request)
    try:
        removed = delete_dataset(dataset_id, tenant_id=tenant_id)
        if not removed:
            raise HTTPException(status_code=404, detail="Dataset not found")
        return ApiResponse(data={"dataset_id": dataset_id, "deleted": True})
    except HTTPException as exc:
        raise exc
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to delete dataset")
