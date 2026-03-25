"""
Job tracking service for idempotency and async processing status.
"""

from __future__ import annotations

import threading
import time
import uuid
from typing import Any, Dict, Optional
from enum import Enum

from app.services.logging_service import log_job_created, log_job_completed, log_job_failed
from app.services.metrics_service import record_job_created, record_job_completed, record_job_failed


class JobStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class JobType(str, Enum):
    DATASET_UPLOAD = "dataset_upload"
    DATASET_PROCESSING = "dataset_processing"
    ANALYTICS_COMPUTATION = "analytics_computation"
    CACHE_INVALIDATION = "cache_invalidation"


class Job:
    def __init__(
        self,
        job_id: str,
        job_type: JobType,
        tenant_id: str,
        dataset_id: str | None = None,
        version_id: str | None = None,
        parameters: Dict[str, Any] | None = None,
    ):
        self.job_id = job_id
        self.job_type = job_type
        self.tenant_id = tenant_id
        self.dataset_id = dataset_id
        self.version_id = version_id
        self.parameters = parameters or {}
        self.status = JobStatus.PENDING
        self.created_at = time.monotonic()
        self.started_at: Optional[float] = None
        self.completed_at: Optional[float] = None
        self.result: Optional[Any] = None
        self.error: Optional[str] = None
        self.progress = 0.0

    def start(self) -> None:
        self.status = JobStatus.RUNNING
        self.started_at = time.monotonic()

    def complete(self, result: Any) -> None:
        self.status = JobStatus.COMPLETED
        self.completed_at = time.monotonic()
        self.result = result
        self.progress = 100.0

    def fail(self, error: str) -> None:
        self.status = JobStatus.FAILED
        self.completed_at = time.monotonic()
        self.error = error

    def update_progress(self, progress: float) -> None:
        self.progress = min(100.0, max(0.0, progress))

    def to_dict(self) -> Dict[str, Any]:
        return {
            "job_id": self.job_id,
            "job_type": self.job_type,
            "tenant_id": self.tenant_id,
            "dataset_id": self.dataset_id,
            "version_id": self.version_id,
            "status": self.status,
            "created_at": self.created_at,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "progress": self.progress,
            "error": self.error,
            "parameters": self.parameters,
        }


# In-memory job storage (in production, use Redis or database)
_jobs: Dict[str, Job] = {}
_lock = threading.Lock()


def create_job(
    job_type: JobType,
    tenant_id: str,
    dataset_id: str | None = None,
    version_id: str | None = None,
    parameters: Dict[str, Any] | None = None,
) -> Job:
    """Create a new job."""
    job_id = str(uuid.uuid4())
    job = Job(job_id, job_type, tenant_id, dataset_id, version_id, parameters)
    
    with _lock:
        _jobs[job_id] = job
    
    log_job_created(job_id, job_type, tenant_id, dataset_id, version_id)
    record_job_created(job_type, tenant_id)
    return job


def get_job(job_id: str) -> Optional[Job]:
    """Get a job by ID."""
    with _lock:
        return _jobs.get(job_id)


def update_job(job_id: str, **kwargs) -> bool:
    """Update job attributes."""
    with _lock:
        job = _jobs.get(job_id)
        if not job:
            return False
        
        for key, value in kwargs.items():
            if hasattr(job, key):
                setattr(job, key, value)
        return True


def complete_job(job_id: str, result: Any) -> bool:
    """Mark a job as completed."""
    job = get_job(job_id)
    if not job:
        return False
    
    job.complete(result)
    log_job_completed(job_id, job.job_type, job.tenant_id)
    record_job_completed(job.job_type, job.tenant_id)
    return True


def fail_job(job_id: str, error: str) -> bool:
    """Mark a job as failed."""
    job = get_job(job_id)
    if not job:
        return False
    
    job.fail(error)
    log_job_failed(job_id, job.job_type, job.tenant_id, error)
    record_job_failed(job.job_type, job.tenant_id)
    return True


def find_duplicate_job(
    job_type: JobType,
    tenant_id: str,
    dataset_id: str | None = None,
    version_id: str | None = None,
    parameters: Dict[str, Any] | None = None,
) -> Optional[Job]:
    """Find a running or pending duplicate job."""
    with _lock:
        for job in _jobs.values():
            if (
                job.job_type == job_type
                and job.tenant_id == tenant_id
                and job.dataset_id == dataset_id
                and job.version_id == version_id
                and job.parameters == (parameters or {})
                and job.status in [JobStatus.PENDING, JobStatus.RUNNING]
            ):
                return job
    return None


def cleanup_old_jobs(max_age_seconds: int = 3600) -> int:
    """Clean up old completed/failed jobs."""
    now = time.monotonic()
    to_remove = []
    
    with _lock:
        for job_id, job in _jobs.items():
            if (
                job.status in [JobStatus.COMPLETED, JobStatus.FAILED]
                and job.completed_at
                and (now - job.completed_at) > max_age_seconds
            ):
                to_remove.append(job_id)
        
        for job_id in to_remove:
            del _jobs[job_id]
    
    return len(to_remove)


def get_tenant_jobs(tenant_id: str) -> list[Job]:
    """Get all jobs for a tenant."""
    with _lock:
        return [job for job in _jobs.values() if job.tenant_id == tenant_id]


def get_dataset_jobs(tenant_id: str, dataset_id: str, version_id: str | None = None) -> list[Job]:
    """Get all jobs for a specific dataset."""
    with _lock:
        return [
            job for job in _jobs.values()
            if job.tenant_id == tenant_id
            and job.dataset_id == dataset_id
            and (version_id is None or job.version_id == version_id)
        ]
