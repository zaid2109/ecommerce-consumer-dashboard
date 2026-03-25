from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app
from app.rate_limit import limiter


@pytest.fixture(autouse=True)
def _isolate_storage_and_disable_auth(tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Default test behavior:
    - isolate storage in a temp dir
    - disable auth so existing API tests keep working

    Individual tests can override settings as needed.
    """

    monkeypatch.setattr(settings, "data_root", tmp_path / "data", raising=False)
    # keep tests focused on functionality; auth tests will explicitly enable auth
    monkeypatch.setattr(settings, "auth_required", False, raising=False)

    # Prevent cross-test pollution (TestClient uses a fixed remote address)
    # causing 429s from SlowAPI.
    if hasattr(limiter, "enabled"):
        monkeypatch.setattr(limiter, "enabled", False, raising=False)
    if hasattr(app.state, "limiter") and hasattr(app.state.limiter, "enabled"):
        monkeypatch.setattr(app.state.limiter, "enabled", False, raising=False)


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)
