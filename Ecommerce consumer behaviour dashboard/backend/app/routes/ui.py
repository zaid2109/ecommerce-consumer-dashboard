from __future__ import annotations

from fastapi import APIRouter, Query

from app.models.schemas import ApiResponse
from app.services.ui_service import get_customers, get_events, get_homepage, get_products

router = APIRouter(tags=["ui"])


@router.get("/homepage", response_model=ApiResponse)
def homepage() -> ApiResponse:
    payload = get_homepage()
    return ApiResponse(data=payload.get("data", {}))


@router.get("/customers", response_model=ApiResponse)
def customers(limit: int = Query(200, ge=1, le=2000)) -> ApiResponse:
    return ApiResponse(data=get_customers(limit))


@router.get("/products", response_model=ApiResponse)
def products(limit: int = Query(200, ge=1, le=1000)) -> ApiResponse:
    return ApiResponse(data=get_products(limit))


@router.get("/events", response_model=ApiResponse)
def events(limit: int = Query(120, ge=1, le=365)) -> ApiResponse:
    return ApiResponse(data=get_events(limit))
