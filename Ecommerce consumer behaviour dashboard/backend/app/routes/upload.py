from fastapi import APIRouter, BackgroundTasks, File, Request, Response, UploadFile

from app.models.schemas import ApiResponse
from app.rate_limit import limiter
from app.services.analytics_async_service import enqueue_precompute
from app.services.ingestion_service import upload_dataset
from app.services.storage_service import get_tenant_id

router = APIRouter(tags=["upload"])


@router.post("/upload", response_model=ApiResponse)
@limiter.limit("5/minute")
def upload(
    request: Request,
    response: Response,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
) -> ApiResponse:
    tenant_id = get_tenant_id(request)
    result = upload_dataset(file, tenant_id=tenant_id)
    dataset_id = result.get("dataset_id") if isinstance(result, dict) else None
    if isinstance(dataset_id, str) and dataset_id:
        enqueue_precompute(background_tasks, dataset_id)
    return ApiResponse(data=result)
