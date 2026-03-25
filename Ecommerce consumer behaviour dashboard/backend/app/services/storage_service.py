from __future__ import annotations

from pathlib import Path

from app.config import settings
from app.db.duckdb_manager import DuckDBManager
from app.utils.helpers import read_json, to_identifier, write_json
from fastapi import HTTPException

JsonPrimitive = str | int | float | bool | None
JsonValue = JsonPrimitive | dict[str, "JsonValue"] | list["JsonValue"]

def init_storage() -> None:
    settings.data_root.mkdir(parents=True, exist_ok=True)
    settings.uploads_dir.mkdir(parents=True, exist_ok=True)
    if not settings.metadata_file.exists():
        write_json(settings.metadata_file, {})

def load_metadata() -> dict[str, JsonValue]:
    init_storage()
    return read_json(settings.metadata_file)

def save_metadata(data: dict[str, JsonValue]) -> None:
    init_storage()
    write_json(settings.metadata_file, data)

def get_tenant_id(request) -> str | None:
    """Extract tenant_id from Clerk JWT; maps to user['sub']."""
    user = getattr(request.state, "user", None)
    if isinstance(user, dict):
        return user.get("sub")
    return None

def get_dataset(dataset_id: str, version_id: str | None = None, *, tenant_id: str | None = None) -> dict[str, JsonValue] | None:
    metadata = load_metadata()
    # If version_id is provided, fetch that specific version; otherwise, fetch the latest version
    if version_id:
        key = f"{dataset_id}::v{version_id}"
        value = metadata.get(key)
    else:
        # Find the latest version for this dataset_id
        latest_key = None
        latest_version = -1
        for key in metadata:
            if key.startswith(f"{dataset_id}::v"):
                try:
                    v = int(key.split("::v")[1])
                    if v > latest_version:
                        latest_version = v
                        latest_key = key
                except Exception:
                    continue
        value = metadata.get(latest_key) if latest_key else metadata.get(dataset_id)
    if not isinstance(value, dict):
        return None
    if tenant_id is not None and value.get("tenant_id") != tenant_id:
        raise HTTPException(status_code=403, detail="Access to this dataset is forbidden")
    return value

def list_dataset_versions(dataset_id: str, *, tenant_id: str | None = None) -> list[dict[str, JsonValue]]:
    metadata = load_metadata()
    versions = []
    legacy = metadata.get(dataset_id)
    if isinstance(legacy, dict):
        if tenant_id is None or legacy.get("tenant_id") == tenant_id:
            versions.append(legacy)
    for key, value in metadata.items():
        if isinstance(value, dict) and key.startswith(f"{dataset_id}::v"):
            if tenant_id is not None and value.get("tenant_id") != tenant_id:
                continue
            versions.append(value)
    # Sort by version_id descending (latest first)
    versions.sort(key=lambda d: int(d.get("version_id", 0)), reverse=True)
    return versions

def list_datasets(*, tenant_id: str | None = None) -> list[dict[str, JsonValue]]:
    metadata = load_metadata()
    # Only return the latest version per dataset_id
    latest_by_dataset = {}
    for key, value in metadata.items():
        if not isinstance(value, dict):
            continue
        if tenant_id is not None and value.get("tenant_id") != tenant_id:
            continue
        if "::v" in key:
            base_id = key.split("::v")[0]
            version_id = int(value.get("version_id", 0))
            if base_id not in latest_by_dataset or version_id > int(latest_by_dataset[base_id].get("version_id", 0)):
                latest_by_dataset[base_id] = value
        else:
            dataset_id = str(value.get("dataset_id") or key)
            # Prefer explicit versioned datasets if they exist; otherwise include legacy entry.
            if dataset_id not in latest_by_dataset:
                latest_by_dataset[dataset_id] = value
    datasets = list(latest_by_dataset.values())
    return sorted(datasets, key=lambda item: str(item.get("created_at", "")), reverse=True)


def dataset_file_path(dataset_id: str, source_name: str) -> Path:
    ext = Path(source_name).suffix or ".csv"
    return settings.uploads_dir / f"{dataset_id}{ext}"


def delete_dataset(dataset_id: str, *, tenant_id: str | None = None) -> bool:
    metadata = load_metadata()
    # Delete all versions of the dataset
    keys_to_delete = [key for key in metadata if key.startswith(f"{dataset_id}::v")]
    if dataset_id in metadata:
        keys_to_delete.append(dataset_id)
    if not keys_to_delete:
        return False
    # Check tenant ownership for at least one version
    for key in keys_to_delete:
        value = metadata.get(key)
        if isinstance(value, dict) and tenant_id is not None and value.get("tenant_id") != tenant_id:
            raise HTTPException(status_code=403, detail="Access to this dataset is forbidden")
        break
    # Proceed to delete all versions
    for key in keys_to_delete:
        dataset = metadata.pop(key, None)
        if isinstance(dataset, dict):
            tables = (dataset.get("tables") or {}).values()
            db = DuckDBManager.instance()
            for table in tables:
                if table:
                    db.execute(f"drop table if exists {to_identifier(table)}")
            file_path = Path(dataset.get("source_file_path") or "")
            if file_path.exists():
                file_path.unlink(missing_ok=True)
    save_metadata(metadata)
    return True
