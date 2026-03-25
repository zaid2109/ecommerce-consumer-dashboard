from __future__ import annotations

from fastapi import APIRouter

from app.models.schemas import ApiResponse
from app.services.ml_service import train_from_local_datasets


router = APIRouter(tags=["ml"], prefix="/ml")


@router.post("/train", response_model=ApiResponse)
def train() -> ApiResponse:
    """
    Train an unsupervised segmentation model on all CSV files
    found in the configured Dataset directory.
    """
    result = train_from_local_datasets()
    return ApiResponse(data=result)

