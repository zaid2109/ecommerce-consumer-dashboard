from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
import shutil
from fastapi import HTTPException

from app.config import settings
from app.db.duckdb_manager import DuckDBManager
from app.services.profiling_service import build_profile
from app.services.schema_service import classify_columns, infer_roles, module_availability
from app.services.storage_service import dataset_file_path, load_metadata, save_metadata
from app.services.ml_service import train_for_dataset
from app.utils.helpers import normalize_columns, random_id, to_identifier


JsonPrimitive = str | int | float | bool | None
JsonValue = JsonPrimitive | dict[str, "JsonValue"] | list["JsonValue"]


def load_default_sales_dataset() -> dict[str, JsonValue]:
    """
    Load Sales.csv from the configured Dataset directory and register it
    as the only dataset, replacing existing metadata.
    """
    sales_path = settings.local_dataset_dir / "Sales.csv"
    if not sales_path.exists():
        repo_root = Path(__file__).resolve().parents[4]
        fallback = repo_root / "Dataset" / "Sales.csv"
        sales_path = fallback
    if not sales_path.exists():
        # Try the sample-ecommerce.csv file as fallback
        repo_root = Path(__file__).resolve().parents[4]
        fallback = repo_root / "public" / "sample-ecommerce.csv"
        sales_path = fallback
    if not sales_path.exists():
        raise HTTPException(status_code=400, detail=f"Default dataset not found at {sales_path}")

    settings.uploads_dir.mkdir(parents=True, exist_ok=True)

    dataset_id = random_id("ds")
    created_at = datetime.now(tz=timezone.utc).isoformat()
    source_name = "Sales.csv"
    file_path = dataset_file_path(dataset_id, source_name)
    shutil.copyfile(sales_path, file_path)

    raw_table = f"raw_{dataset_id}"
    clean_table = f"clean_{dataset_id}"
    db = DuckDBManager.instance()
    csv_path = str(file_path.as_posix())
    db.execute(
        f"create or replace table {to_identifier(raw_table)} as select * from read_csv_auto('{csv_path}', header=true, sample_size=200000)"
    )
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
        f"create or replace table {to_identifier(clean_table)} as select distinct {', '.join(select_parts)} from {to_identifier(raw_table)}"
    )
    row_count = db.fetch_one(f"select count(*) as count from {to_identifier(clean_table)}") or {"count": 0}
    if int(row_count["count"]) == 0:
        raise HTTPException(status_code=400, detail="Sales.csv has no rows after cleaning")
    sample = db.conn.execute(f"select * from {to_identifier(clean_table)} limit 20000").df()

    schema = classify_columns(sample)
    roles = infer_roles(schema)
    profile = build_profile(sample, schema)
    modules = module_availability(roles)

    # Replace existing metadata with this dataset as the only one.
    metadata: dict[str, JsonValue] = {}
    metadata[dataset_id] = {
        "dataset_id": dataset_id,
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

    preview = sample.head(10).where(sample.notnull(), None).to_dict(orient="records")
    response: dict[str, JsonValue] = {
        "dataset_id": dataset_id,
        "row_count": int(row_count["count"]),
        "columns": list(column_map.values()),
        "schema": schema,
        "preview": preview,
    }
    try:
        response["ml"] = train_for_dataset(dataset_id)
    except Exception:
        response["ml"] = None
    return response
