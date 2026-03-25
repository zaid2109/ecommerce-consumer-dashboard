from __future__ import annotations

from fastapi import Request
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app


def _ensure_whoami_route() -> None:
    # Avoid registering the route multiple times across test runs.
    for route in app.routes:
        if getattr(route, "path", None) == "/_test/whoami":
            return

    @app.get("/_test/whoami")
    def _whoami(request: Request):
        user = getattr(getattr(request, "state", object()), "user", None)
        return {"user": user}


def test_csv_upload_success(client: TestClient) -> None:
    csv = """order_id,customer_id,product_id,category,price,quantity,payment_method,order_date
1,c1,p1,electronics,1200,1,card,2025-01-01
"""
    response = client.post("/upload", files={"file": ("sample.csv", csv, "text/csv")})
    assert response.status_code == 200

    payload = response.json()
    assert payload.get("status") == "ok"
    data = payload.get("data")
    assert isinstance(data, dict)

    assert "dataset_id" in data
    assert "row_count" in data
    assert "columns" in data
    assert "schema" in data
    assert "preview" in data


def test_csv_upload_failure_size_limit(monkeypatch) -> None:
    # Keep memory use minimal while still validating the size-limit path.
    # We temporarily set max_upload_mb small and upload a payload larger than that.
    monkeypatch.setattr(settings, "auth_required", False, raising=False)
    monkeypatch.setattr(settings, "max_upload_mb", 1, raising=False)

    client = TestClient(app)

    too_big = b"a" * (2 * 1024 * 1024)  # 2MB > 1MB limit
    response = client.post(
        "/upload",
        files={"file": ("large.csv", too_big, "text/csv")},
    )

    assert response.status_code == 413
    body = response.json()
    assert "detail" in body


def test_auth_middleware_no_token_401(monkeypatch) -> None:
    monkeypatch.setattr(settings, "auth_required", True, raising=False)
    monkeypatch.setattr(settings, "clerk_jwks_url", "https://example.invalid/jwks", raising=False)

    client = TestClient(app)
    response = client.get("/datasets")
    assert response.status_code == 401


def test_auth_middleware_invalid_token_401(monkeypatch) -> None:
    monkeypatch.setattr(settings, "auth_required", True, raising=False)
    monkeypatch.setattr(settings, "clerk_jwks_url", "https://example.invalid/jwks", raising=False)

    def _reject(_: str):
        raise Exception("invalid")

    monkeypatch.setattr("app.main.verify_clerk_jwt", _reject)

    client = TestClient(app)
    response = client.get("/datasets", headers={"Authorization": "Bearer invalid"})
    assert response.status_code == 401


def test_auth_middleware_valid_token_success(monkeypatch) -> None:
    monkeypatch.setattr(settings, "auth_required", True, raising=False)
    monkeypatch.setattr(settings, "clerk_jwks_url", "https://example.invalid/jwks", raising=False)

    def _accept(_: str):
        return {"sub": "user_123"}

    monkeypatch.setattr("app.main.verify_clerk_jwt", _accept)

    _ensure_whoami_route()

    client = TestClient(app)
    response = client.get("/datasets", headers={"Authorization": "Bearer valid"})
    assert response.status_code == 200

    # Validate that middleware attached claims to request.state.user by hitting a test-only endpoint.
    whoami = client.get("/_test/whoami", headers={"Authorization": "Bearer valid"})
    assert whoami.status_code == 200
    assert whoami.json().get("user") == {"sub": "user_123"}


def test_basic_schema_detection_after_upload(client: TestClient) -> None:
    csv = """order_id,customer_id,product_id,category,price,quantity,payment_method,order_date
1,c1,p1,electronics,1200,1,card,2025-01-01
2,c2,p2,fashion,300,2,cod,2025-01-02
"""
    upload = client.post("/upload", files={"file": ("sample.csv", csv, "text/csv")})
    assert upload.status_code == 200
    dataset_id = upload.json()["data"]["dataset_id"]

    schema = client.get("/schema", params={"dataset_id": dataset_id})
    assert schema.status_code == 200
    schema_payload = schema.json()["data"]
    assert isinstance(schema_payload, dict)
    schema_data = schema_payload.get("data") if "data" in schema_payload else schema_payload
    assert isinstance(schema_data, dict)
    assert "schema" in schema_data
    assert "roles" in schema_data

    profile = client.get("/profile", params={"dataset_id": dataset_id})
    assert profile.status_code == 200
    profile_payload = profile.json()["data"]
    assert isinstance(profile_payload, dict)
    profile_data = profile_payload.get("data") if "data" in profile_payload else profile_payload
    assert isinstance(profile_data, dict)
    assert "row_count" in profile_data
    assert "column_count" in profile_data
