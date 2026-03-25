from __future__ import annotations

from fastapi import APIRouter

from app.models.schemas import ApiResponse
from app.services.default_dataset_service import load_default_sales_dataset


router = APIRouter(tags=["default-dataset"], prefix="/default-dataset")


@router.post("/load-sales", response_model=ApiResponse)
def load_sales() -> ApiResponse:
    """
    Replace current dataset metadata and tables with Sales.csv as the default dataset.
    """
    result = load_default_sales_dataset()
    return ApiResponse(data=result)

