from __future__ import annotations

import numpy as np
import pandas as pd


JsonPrimitive = str | int | float | bool | None
JsonValue = JsonPrimitive | dict[str, "JsonValue"] | list["JsonValue"]


def build_profile(df: pd.DataFrame, schema: list[dict[str, JsonValue]]) -> dict[str, JsonValue]:
    numerical_columns = [col["name"] for col in schema if col["inferred_type"] == "numerical"]
    categorical_columns = [col["name"] for col in schema if col["inferred_type"] == "categorical"]
    summary_stats: dict[str, JsonValue] = {}
    for col in numerical_columns:
        values = pd.to_numeric(df[col], errors="coerce").dropna()
        summary_stats[col] = {
            "mean": float(values.mean()) if len(values) else 0.0,
            "median": float(values.median()) if len(values) else 0.0,
            "std": float(values.std(ddof=0)) if len(values) else 0.0,
            "min": float(values.min()) if len(values) else 0.0,
            "max": float(values.max()) if len(values) else 0.0,
        }
    missing = {col: float(df[col].isna().mean()) for col in df.columns}
    unique = {col: int(df[col].nunique(dropna=True)) for col in df.columns}
    corr = {}
    if numerical_columns:
        matrix = (
            df[numerical_columns]
            .apply(lambda s: pd.to_numeric(s, errors="coerce"))
            .corr()
            .replace([np.nan], 0)
        )
        corr = matrix.round(4).to_dict()
    top_categories = {}
    for col in categorical_columns:
        counts = df[col].astype(str).value_counts(dropna=True).head(10)
        top_categories[col] = [{"value": idx, "count": int(count)} for idx, count in counts.items()]
    return {
        "row_count": int(len(df)),
        "column_count": int(len(df.columns)),
        "summary_stats": summary_stats,
        "missing_values": missing,
        "unique_counts": unique,
        "correlation_matrix": corr,
        "top_categories": top_categories,
    }
