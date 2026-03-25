from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
import threading

from fastapi import HTTPException, UploadFile

from app.config import settings
from app.db.duckdb_manager import DuckDBManager
from app.services.profiling_service import build_profile
from app.services.schema_service import (
    classify_columns,
    infer_roles,
    module_availability,
)
from app.services.storage_service import dataset_file_path, load_metadata, save_metadata
from app.services.metrics_service import record_dataset_upload
from app.services.ml_service import train_for_dataset
from app.utils.helpers import normalize_columns, random_id, to_identifier


JsonPrimitive = str | int | float | bool | None
JsonValue = JsonPrimitive | dict[str, "JsonValue"] | list["JsonValue"]


def _store_upload(file: UploadFile, file_path) -> None:
    max_bytes = settings.max_upload_mb * 1024 * 1024
    file.file.seek(0)
    total = 0
    with open(file_path, "wb") as out:
        while True:
            chunk = file.file.read(4 * 1024 * 1024)
            if not chunk:
                break
            total += len(chunk)
            if total > max_bytes:
                out.close()
                file_path.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail=f"File exceeds {settings.max_upload_mb}MB")
            out.write(chunk)


def _train_async(dataset_id: str) -> None:
    try:
        train_for_dataset(dataset_id)
    except Exception:
        return


def _to_utf8_copy(file_path: Path) -> Path:
    converted = file_path.with_suffix(f"{file_path.suffix}.utf8.csv")
    content = file_path.read_bytes()
    converted.write_text(content.decode("latin-1"), encoding="utf-8", newline="")
    return converted


def _create_raw_table(db: DuckDBManager, raw_table: str, file_path: Path) -> None:
    csv_path = str(file_path.as_posix())
    base_sql = f"create or replace table {to_identifier(raw_table)} as select * from read_csv_auto('{csv_path}', header=true, sample_size={settings.csv_sniff_rows}"
    try:
        db.execute(f"{base_sql})")
        return
    except Exception:
        try:
            converted = _to_utf8_copy(file_path)
            converted_path = str(converted.as_posix())
            db.execute(
                f"create or replace table {to_identifier(raw_table)} as select * from read_csv_auto('{converted_path}', header=true, sample_size={settings.csv_sniff_rows})"
            )
            converted.unlink(missing_ok=True)
            return
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Could not parse CSV: {exc}") from exc


def upload_dataset(file: UploadFile, *, tenant_id: str | None = None) -> dict[str, JsonValue]:
    settings.uploads_dir.mkdir(parents=True, exist_ok=True)
    # Determine base dataset_id (reuse existing if uploading a new version)
    base_dataset_id = random_id("ds")
    version_id = 1  # default for new dataset
    metadata = load_metadata()
    # Find the latest version for this tenant to increment version_id if reusing base_dataset_id
    # For now, always create a new base_dataset_id; future versions can reuse via API
    created_at = datetime.now(tz=timezone.utc).isoformat()
    source_name = file.filename or "uploaded.csv"
    file_path = dataset_file_path(base_dataset_id, source_name)
    _store_upload(file, file_path)
    raw_table = f"raw_{base_dataset_id}_v{version_id}"
    clean_table = f"clean_{base_dataset_id}_v{version_id}"
    db = DuckDBManager.instance()
    _create_raw_table(db, raw_table, file_path)
    raw_columns = db.conn.execute(f"select * from {to_identifier(raw_table)} limit 0").df().columns.tolist()
    column_map = normalize_columns(raw_columns)
    if not column_map:
        raise HTTPException(status_code=400, detail="No usable columns found after normalization")
    select_parts = []
    for raw_name, normalized in column_map.items():
        raw_identifier = to_identifier(raw_name)
        select_parts.append(
            f"case when trim(cast({raw_identifier} as varchar)) = '' then null else {raw_identifier} end as {to_identifier(normalized)}"
        )
    db.execute(
        f"create or replace table {to_identifier(clean_table)} as select {', '.join(select_parts)} from {to_identifier(raw_table)}"
    )
    row_count = db.fetch_one(f"select count(*) as count from {to_identifier(clean_table)}") or {"count": 0}
    if int(row_count["count"]) == 0:
        raise HTTPException(status_code=400, detail="CSV has no rows after cleaning")
    # Record dataset size metric
    record_dataset_upload(base_dataset_id, tenant_id, int(row_count["count"]))
    sample_rows = max(1000, min(settings.profiling_sample_rows, int(row_count["count"])))
    sample = db.conn.execute(
        f"select * from {to_identifier(clean_table)} using sample {sample_rows} rows"
    ).df()
    schema = classify_columns(sample)
    roles = infer_roles(schema)
    profile = build_profile(sample, schema)
    modules = module_availability(roles)
    metadata_key = f"{base_dataset_id}::v{version_id}"
    metadata[metadata_key] = {
        "tenant_id": tenant_id,
        "dataset_id": base_dataset_id,
        "version_id": version_id,
        "created_at": created_at,
        "source_file_name": source_name,
        "source_file_path": str(file_path),
        "row_count": int(row_count["count"]),
        "columns": list(column_map.values()),
        "schema": schema,
        "roles": roles,
        "profile": profile,
        "modules": modules,
        "tables": {"raw": raw_table, "clean": clean_table},
    }
    save_metadata(metadata)
    
    # Clear cache for this dataset (all versions) and tenant
    from app.services.cache import clear_dataset_cache
    clear_dataset_cache(base_dataset_id, None, tenant_id)
    
    preview = sample.head(10).where(sample.notnull(), None).to_dict(orient="records")
    if settings.train_on_upload:
        trainer = threading.Thread(target=_train_async, args=(base_dataset_id,), daemon=True)
        trainer.start()

    response: dict[str, JsonValue] = {
        "dataset_id": base_dataset_id,
        "version_id": version_id,
        "row_count": int(row_count["count"]),
        "columns": list(column_map.values()),
        "schema": schema,
        "preview": preview,
    }
    return response
