"""
Job status and tracking endpoints.
"""

from fastapi import APIRouter, HTTPException, Request, Response
from typing import List

from app.models.schemas import ApiResponse
from app.rate_limit import limiter
from app.services.storage_service import get_tenant_id
from app.services.job_service import get_job, get_tenant_jobs, get_dataset_jobs

router = APIRouter(tags=["jobs"])


@router.get("/jobs/{job_id}", response_model=ApiResponse)
@limiter.limit("30/minute")
def get_job_status(
    request: Request,
    response: Response,
    job_id: str,
) -> ApiResponse:
    """Get the status of a specific job."""
    tenant_id = get_tenant_id(request)
    if not tenant_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if job.tenant_id != tenant_id:
        raise HTTPException(status_code=403, detail="Access to this job is forbidden")
    
    return ApiResponse(data=job.to_dict())


@router.get("/jobs", response_model=ApiResponse)
@limiter.limit("20/minute")
def list_tenant_jobs(
    request: Request,
    response: Response,
) -> ApiResponse:
    """List all jobs for the authenticated tenant."""
    tenant_id = get_tenant_id(request)
    if not tenant_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    jobs = get_tenant_jobs(tenant_id)
    job_data = [job.to_dict() for job in jobs]
    
    # Sort by created_at descending
    job_data.sort(key=lambda x: x.get("created_at", 0), reverse=True)
    
    return ApiResponse(data={"jobs": job_data, "total": len(job_data)})


@router.get("/datasets/{dataset_id}/jobs", response_model=ApiResponse)
@limiter.limit("20/minute")
def list_dataset_jobs(
    request: Request,
    response: Response,
    dataset_id: str,
    version_id: str | None = None,
) -> ApiResponse:
    """List all jobs for a specific dataset."""
    tenant_id = get_tenant_id(request)
    if not tenant_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    jobs = get_dataset_jobs(tenant_id, dataset_id, version_id)
    job_data = [job.to_dict() for job in jobs]
    
    # Sort by created_at descending
    job_data.sort(key=lambda x: x.get("created_at", 0), reverse=True)
    
    return ApiResponse(data={"jobs": job_data, "total": len(job_data)})
