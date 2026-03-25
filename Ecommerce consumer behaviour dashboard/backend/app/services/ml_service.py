from __future__ import annotations

from pathlib import Path
import time

import numpy as np
import pandas as pd
from fastapi import HTTPException
from sklearn.cluster import MiniBatchKMeans
from sklearn.preprocessing import StandardScaler
import joblib

from app.config import settings
from app.db.duckdb_manager import DuckDBManager
from app.services.storage_service import load_metadata, save_metadata
from app.utils.helpers import to_identifier
from app.services.logging_service import log_ml_start, log_ml_complete, log_ml_error
from app.services.metrics_service import record_ml_training


JsonPrimitive = str | int | float | bool | None
JsonValue = JsonPrimitive | dict[str, "JsonValue"] | list["JsonValue"]


def _iter_numeric_chunks(csv_path: Path, chunksize: int = 100_000) -> list[pd.DataFrame]:
    frames: list[pd.DataFrame] = []
    for chunk in pd.read_csv(csv_path, chunksize=chunksize, low_memory=False):
        numeric = chunk.select_dtypes(include=["number"])
        if not numeric.empty:
            frames.append(numeric)
    return frames


def train_from_local_datasets() -> dict[str, JsonValue]:
    """
    Legacy helper: train a segmentation model on all CSV files
    from the local dataset directory. Kept for manual runs.
    """
    dataset_dir = settings.local_dataset_dir
    if not dataset_dir.exists():
        raise HTTPException(
            status_code=400, detail=f"Dataset directory not found: {dataset_dir}"
        )

    csv_files = sorted(dataset_dir.glob("*.csv"))
    if not csv_files:
        raise HTTPException(
            status_code=400, detail="No CSV files found in dataset directory"
        )

    all_frames: list[pd.DataFrame] = []
    total_rows = 0
    for path in csv_files:
        chunks = _iter_numeric_chunks(path)
        if chunks:
            df = pd.concat(chunks, ignore_index=True)
            total_rows += len(df)
            all_frames.append(df)

    if not all_frames:
        raise HTTPException(
            status_code=400, detail="No numeric data found in provided datasets"
        )

    full_df = pd.concat(all_frames, ignore_index=True)
    full_df = full_df.dropna(axis=1, how="all")
    if full_df.empty:
        raise HTTPException(
            status_code=400, detail="All numeric columns are empty"
        )

    # Fill missing values with column medians to keep it robust
    full_df = full_df.fillna(full_df.median(numeric_only=True))

    # Limit to a reasonable sample size for training to avoid memory issues
    max_samples = 1_000_000
    if len(full_df) > max_samples:
        full_df = full_df.sample(max_samples, random_state=42)

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(full_df.values)

    n_clusters = min(10, max(2, int(np.sqrt(len(full_df)))))
    model = MiniBatchKMeans(
        n_clusters=n_clusters, batch_size=10_000, random_state=42
    )
    model.fit(X_scaled)

    settings.models_dir.mkdir(parents=True, exist_ok=True)
    model_path = settings.models_dir / "consumer_segmentation.joblib"
    joblib.dump(
        {"scaler": scaler, "model": model, "columns": list(full_df.columns)},
        model_path,
    )

    return {
        "message": "Training completed",
        "model_path": str(model_path),
        "n_rows_used": int(len(full_df)),
        "n_features": int(full_df.shape[1]),
        "n_clusters": int(n_clusters),
        "source_files": [str(p) for p in csv_files],
    }


def train_for_dataset(dataset_id: str) -> dict[str, JsonValue]:
    """
    Train a segmentation model for a specific uploaded dataset.
    This is used automatically when a new CSV is uploaded.
    """
    metadata = load_metadata()
    ds = metadata.get(dataset_id)
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")
    tenant_id = ds.get("tenant_id")
    clean_table = ds.get("tables", {}).get("clean")
    if not clean_table:
        raise HTTPException(
            status_code=400, detail="Clean table not configured for dataset"
        )
    log_ml_start(dataset_id, tenant_id, "segmentation")
    start = time.time()
    try:
        db = DuckDBManager.instance()
        # Load the clean table into a DataFrame
        df = db.conn.execute(
            f"select * from {to_identifier(clean_table)}"
        ).df()

        if df.empty:
            raise HTTPException(status_code=400, detail="Dataset has no rows")

        numeric = df.select_dtypes(include=["number"])
        numeric = numeric.dropna(axis=1, how="all")
        if numeric.empty:
            raise HTTPException(
                status_code=400, detail="No numeric columns available for training"
            )

        numeric = numeric.fillna(numeric.median(numeric_only=True))

        max_samples = 1_000_000
        if len(numeric) > max_samples:
            numeric = numeric.sample(max_samples, random_state=42)

        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(numeric.values)

        n_clusters = min(10, max(2, int(np.sqrt(len(numeric)))))
        model = MiniBatchKMeans(
            n_clusters=n_clusters, batch_size=10_000, random_state=42
        )
        model.fit(X_scaled)

        settings.models_dir.mkdir(parents=True, exist_ok=True)
        model_path = settings.models_dir / f"segmentation_{dataset_id}.joblib"
        joblib.dump(
            {"scaler": scaler, "model": model, "columns": list(numeric.columns)},
            model_path,
        )

        ml_info: dict[str, JsonValue] = {
            "segmentation_model_path": str(model_path),
            "n_rows_used": int(len(numeric)),
            "n_features": int(numeric.shape[1]),
            "n_clusters": int(n_clusters),
        }

        ds["ml"] = ml_info
        metadata[dataset_id] = ds
        save_metadata(metadata)
        duration_ms = (time.time() - start) * 1000
        log_ml_complete(dataset_id, tenant_id, "segmentation", duration_ms)
        record_ml_training(dataset_id, tenant_id, "segmentation", duration_ms)
        return ml_info
    except Exception as exc:
        log_ml_error(dataset_id, tenant_id, "segmentation", exc)
        raise


