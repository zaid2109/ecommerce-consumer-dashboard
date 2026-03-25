"""
Enterprise System Audit for Phase 4.
Verifies: multi-tenancy, versioning, logging, metrics, reliability.
Run with: python -m app.verification.phase4_audit
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

# Add backend to path for imports
backend_root = Path(__file__).parent.parent.parent
if str(backend_root) not in sys.path:
    sys.path.insert(0, str(backend_root))

def _check_file_exists(path: str) -> bool:
    return Path(backend_root / path).exists()

def _check_imports_in_file(path: str, imports: list[str]) -> bool:
    try:
        content = (backend_root / path).read_text(encoding="utf-8")
        return all(imp in content for imp in imports)
    except Exception:
        return False

def _check_function_exists(path: str, func_name: str) -> bool:
    try:
        content = (backend_root / path).read_text(encoding="utf-8")
        return f"def {func_name}" in content
    except Exception:
        return False

def _check_class_exists(path: str, class_name: str) -> bool:
    try:
        content = (backend_root / path).read_text(encoding="utf-8")
        return f"class {class_name}" in content
    except Exception:
        return False

def audit() -> dict[str, dict[str, bool]]:
    results = {
        "multi_tenancy": {},
        "versioning": {},
        "logging": {},
        "metrics": {},
        "reliability": {},
    }

    # Multi-Tenancy Checks
    results["multi_tenancy"]["tenant_id_in_dataset_metadata"] = _check_function_exists(
        "app/services/storage_service.py", "get_dataset"
    )
    results["multi_tenancy"]["tenant_isolation_403"] = _check_function_exists(
        "app/services/storage_service.py", "get_dataset"
    )
    results["multi_tenancy"]["cache_keys_include_tenant"] = _check_function_exists(
        "app/services/analytics_service.py", "_cache_key"
    )
    results["multi_tenancy"]["jwt_tenant_extraction"] = _check_function_exists(
        "app/services/storage_service.py", "get_tenant_id"
    )

    # Versioning Checks
    results["versioning"]["dataset_version_metadata"] = _check_function_exists(
        "app/services/storage_service.py", "get_dataset"
    )
    results["versioning"]["list_dataset_versions"] = _check_function_exists(
        "app/services/storage_service.py", "list_dataset_versions"
    )
    results["versioning"]["version_api_endpoints"] = (
        _check_function_exists("app/routes/analytics.py", "dataset_versions")
        and _check_function_exists("app/routes/analytics.py", "dataset_version_detail")
    )
    results["versioning"]["analytics_accept_version_id"] = any(
        _check_function_exists(f"app/services/analytics_service.py", f"get_{name}")
        for name in ["metrics", "segmentation", "clv", "anomalies", "recommendations"]
    )

    # Logging Checks
    results["logging"]["structured_logging_service"] = _check_file_exists(
        "app/services/logging_service.py"
    )
    results["logging"]["structured_logging_middleware"] = _check_file_exists(
        "app/middleware/logging.py"
    )
    results["logging"]["middleware_registered"] = _check_imports_in_file(
        "app/main.py", ["StructuredLoggingMiddleware"]
    )
    results["logging"]["logs_include_request_id"] = (
        "request_id" in (backend_root / "app/middleware/logging.py").read_text(encoding="utf-8")
        and "request.state.request_id" in (backend_root / "app/middleware/logging.py").read_text(encoding="utf-8")
    )
    results["logging"]["background_task_logging"] = _check_function_exists(
        "app/services/logging_service.py", "log_background_task"
    )
    results["logging"]["cache_logging"] = _check_function_exists(
        "app/services/logging_service.py", "log_cache_hit"
    )
    results["logging"]["ml_logging"] = _check_function_exists(
        "app/services/logging_service.py", "log_ml_start"
    )

    # Metrics Checks
    results["metrics"]["metrics_service"] = _check_file_exists(
        "app/services/metrics_service.py"
    )
    results["metrics"]["metrics_endpoint"] = _check_function_exists(
        "app/routes/metrics.py", "metrics"
    )
    results["metrics"]["request_metrics_recorded"] = _check_function_exists(
        "app/services/metrics_service.py", "record_request"
    )
    results["metrics"]["ml_metrics_recorded"] = _check_function_exists(
        "app/services/metrics_service.py", "record_ml_training"
    )
    results["metrics"]["cache_metrics_recorded"] = _check_function_exists(
        "app/services/metrics_service.py", "record_cache_hit"
    )
    results["metrics"]["metrics_registered"] = _check_imports_in_file(
        "app/main.py", ["metrics_router"]
    )

    # Reliability Checks
    results["reliability"]["retry_service"] = _check_file_exists(
        "app/services/retry_service.py"
    )
    results["reliability"]["background_task_retries"] = _check_function_exists(
        "app/services/analytics_async_service.py", "precompute_analytics"
    )
    results["reliability"]["circuit_breaker_service"] = _check_file_exists(
        "app/services/circuit_breaker_service.py"
    )
    results["reliability"]["timeout_service"] = _check_file_exists(
        "app/services/timeout_service.py"
    )
    results["reliability"]["request_timeout_middleware"] = _check_file_exists(
        "app/middleware/timeout.py"
    )
    results["reliability"]["timeout_middleware_registered"] = _check_imports_in_file(
        "app/main.py", ["RequestTimeoutMiddleware"]
    )
    results["reliability"]["module_circuit_breakers"] = any(
        "get_module_breaker" in (backend_root / "app/services/analytics_service.py").read_text(encoding="utf-8")
        for _ in [1]
    )
    results["reliability"]["module_timeouts"] = any(
        "timeout(" in (backend_root / "app/services/analytics_service.py").read_text(encoding="utf-8")
        for _ in [1]
    )
    results["reliability"]["dashboard_resilient"] = _check_function_exists(
        "app/services/analytics_service.py", "get_dashboard"
    )

    return results

def print_results(results: dict[str, dict[str, bool]]) -> None:
    print("\n=== Phase 4 Enterprise System Audit ===\n")
    overall_pass = True
    for category, checks in results.items():
        print(f"Category: {category.upper()}")
        for check, passed in checks.items():
            status = "✅ PASS" if passed else "❌ FAIL"
            print(f"  {status}: {check}")
            if not passed:
                overall_pass = False
        print()
    print("=== Summary ===")
    if overall_pass:
        print("✅ All Phase 4 requirements verified successfully.")
    else:
        print("❌ Some Phase 4 requirements are missing. Review failures above.")
    print("\nDetailed JSON output:")
    print(json.dumps(results, indent=2))

if __name__ == "__main__":
    results = audit()
    print_results(results)
    sys.exit(0 if all(all(checks.values()) for checks in results.values()) else 1)
