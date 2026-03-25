from __future__ import annotations

import logging
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse as FastApiJSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.responses import JSONResponse

from app.config import settings
from app.routes.analytics import router as analytics_router
from app.routes.analytics_status import router as analytics_status_router
from app.routes.upload import router as upload_router
from app.routes.ml import router as ml_router
from app.routes.default_dataset import router as default_dataset_router
from app.routes.orders import router as orders_router
from app.routes.ui import router as ui_router
from app.routes.metrics import router as metrics_router
from app.routes.dataset import router as dataset_router
from app.services.storage_service import init_storage
from app.services.default_dataset_service import load_default_sales_dataset
from app.middleware.logging import StructuredLoggingMiddleware
from app.middleware.timeout import RequestTimeoutMiddleware
from app.security.clerk import verify_clerk_jwt
from app.rate_limit import limiter

app = FastAPI(title=settings.app_name)
app.state.limiter = limiter

app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

logger = logging.getLogger(__name__)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> FastApiJSONResponse:
    error_id = uuid.uuid4().hex
    logger.exception(
        "Unhandled exception error_id=%s path=%s method=%s",
        error_id,
        request.url.path,
        request.method,
        exc_info=exc,
    )
    return FastApiJSONResponse(
        status_code=500,
        content={"error": "Internal server error", "status": 500},
    )


@app.middleware("http")
async def verify_auth(request: Request, call_next):
    if not settings.auth_required:
        return await call_next(request)

    if not settings.clerk_issuer and not settings.clerk_jwks_url:
        return JSONResponse(
            status_code=500,
            content={
                "error": "Auth is enabled but Clerk JWKS is not configured. Set DASH_CLERK_ISSUER or DASH_CLERK_JWKS_URL.",
                "status": 500,
            },
        )

    path = request.url.path
    if path in {"/health", "/openapi.json", "/docs", "/docs/", "/redoc", "/redoc/"}:
        return await call_next(request)

    auth_header = request.headers.get("authorization")
    if not auth_header or not auth_header.lower().startswith("bearer "):
        return JSONResponse(status_code=401, content={"detail": "Missing Authorization Bearer token"})

    token = auth_header.split(" ", 1)[1].strip()
    if not token:
        return JSONResponse(status_code=401, content={"detail": "Missing Authorization Bearer token"})

    try:
        claims = verify_clerk_jwt(token)
        request.state.user = claims
    except Exception:
        return JSONResponse(status_code=401, content={"detail": "Invalid token"})

    return await call_next(request)


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allow_origins,
    allow_credentials=settings.cors_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(RequestTimeoutMiddleware, timeout_seconds=30.0)
app.add_middleware(StructuredLoggingMiddleware)


@app.on_event("startup")
def startup() -> None:
    init_storage()
    # Ensure Sales.csv from the Dataset folder is the default dataset
    # and replaces previous dummy data.
    try:
        load_default_sales_dataset()
    except Exception:
        # If Sales.csv is missing or invalid, keep the API up;
        # the user can still upload another dataset manually.
        pass


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(upload_router, prefix="/api")
app.include_router(analytics_router, prefix="/api")
app.include_router(analytics_status_router, prefix="/api")
app.include_router(ml_router, prefix="/api")
app.include_router(default_dataset_router, prefix="/api")
app.include_router(orders_router, prefix="/api")
app.include_router(ui_router, prefix="/api")
app.include_router(metrics_router, prefix="/api")
app.include_router(dataset_router, prefix="/api")
