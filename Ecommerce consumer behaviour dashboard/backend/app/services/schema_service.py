from __future__ import annotations

import re

import pandas as pd

from app.config import settings


JsonPrimitive = str | int | float | bool | None
JsonValue = JsonPrimitive | dict[str, "JsonValue"] | list["JsonValue"]

ROLE_PATTERNS: dict[str, list[str]] = {
    "customer_id": ["customer", "client", "buyer", "user", "dim_customer_key", "customer_id"],
    "order_id": ["order", "invoice", "transaction", "receipt", "cart_id"],
    "product_id": ["product", "sku", "item", "product_id"],
    "category": ["category", "segment", "group", "type", "city", "location", "region"],
    "revenue": ["revenue", "sales", "amount", "value", "price", "total"],
    "quantity": ["quantity", "qty", "units", "count"],
    "timestamp": ["date", "time", "timestamp", "created", "ordered"],
    "payment_method": ["payment", "method", "channel", "tender"],
    "return_status": ["return", "refund_status", "return_status"],
    "refund_amount": ["refund", "chargeback", "returned_amount"],
}

ROLE_TYPE_COMPATIBILITY = {
    "customer_id": {"text", "categorical", "numerical"},
    "order_id": {"text", "categorical", "numerical"},
    "product_id": {"text", "categorical", "numerical"},
    "category": {"categorical", "text"},
    "revenue": {"numerical"},
    "quantity": {"numerical"},
    "timestamp": {"datetime"},
    "payment_method": {"categorical", "text"},
    "return_status": {"categorical", "text", "boolean"},
    "refund_amount": {"numerical"},
}

ROLE_OVERRIDES: dict[str, list[str]] = {
    "timestamp": ["date_", "order_date", "date"],
    "revenue": ["total_weighted_landing_price", "total_price", "unit_selling_price", "price", "revenue"],
    "customer_id": ["dim_customer_key", "customer_id"],
    "order_id": ["order_id", "cart_id"],
    "product_id": ["product_id"],
    "category": ["city_name", "category"],
    "quantity": ["procured_quantity", "quantity"],
}


def classify_columns(df: pd.DataFrame) -> list[dict[str, JsonValue]]:
    columns: list[dict[str, JsonValue]] = []
    row_count = max(1, len(df))
    for name in df.columns:
        series = df[name]
        name_lower = str(name).strip().lower()
        has_date_hint = bool(re.search(r"(date|time|timestamp|day|month|year)", name_lower))
        non_null = series.dropna()
        non_null_count = len(non_null)
        null_rate = float(1 - (non_null_count / row_count))
        unique_ratio = float((non_null.nunique() / max(1, non_null_count)))
        numeric_ratio = float(pd.to_numeric(non_null.astype(str).str.replace(",", ""), errors="coerce").notna().mean()) if non_null_count else 0.0
        datetime_ratio = float(pd.to_datetime(non_null, errors="coerce", utc=True).notna().mean()) if non_null_count else 0.0
        normalized = non_null.astype(str).str.strip().str.lower()
        boolean_ratio = float(normalized.isin(["true", "false", "1", "0", "yes", "no", "y", "n", "t", "f"]).mean()) if non_null_count else 0.0
        inferred_type = "text"
        if boolean_ratio >= 0.9:
            inferred_type = "boolean"
        elif datetime_ratio >= 0.75 and (has_date_hint or numeric_ratio < 0.9):
            inferred_type = "datetime"
        elif numeric_ratio >= 0.85:
            inferred_type = "numerical"
        elif unique_ratio <= 0.2:
            inferred_type = "categorical"
        if inferred_type == "categorical" and unique_ratio > 0.6:
            inferred_type = "text"
        columns.append(
            {
                "name": name,
                "inferred_type": inferred_type,
                "null_rate": null_rate,
                "unique_ratio": unique_ratio,
                "parse_ratios": {
                    "numeric": numeric_ratio,
                    "datetime": datetime_ratio,
                    "boolean": boolean_ratio,
                },
            }
        )
    return columns


def infer_roles(columns: list[dict[str, JsonValue]]) -> dict[str, dict[str, JsonValue]]:
    roles: dict[str, dict[str, JsonValue]] = {}
    column_names = {str(column["name"]).lower(): str(column["name"]) for column in columns}
    for role, patterns in ROLE_PATTERNS.items():
        override_candidates = ROLE_OVERRIDES.get(role, [])
        for override in override_candidates:
            if override.lower() in column_names:
                selected = column_names[override.lower()]
                candidates = [{"column": selected, "confidence": 1.0}]
                roles[role] = {
                    "column": selected,
                    "confidence": 1.0,
                    "candidates": candidates,
                }
                break
        if role in roles:
            continue
        candidates: list[dict[str, JsonValue]] = []
        for column in columns:
            name = str(column["name"]).lower()
            type_score = 1.0 if column["inferred_type"] in ROLE_TYPE_COMPATIBILITY[role] else 0.0
            matches = sum(1 for pattern in patterns if re.search(pattern, name))
            name_score = matches / max(1, len(patterns))
            quality_score = 1 - float(column["null_rate"])
            confidence = min(1.0, max(0.0, name_score * 0.65 + type_score * 0.2 + quality_score * 0.15))
            candidates.append({"column": column["name"], "confidence": round(confidence, 3)})
        candidates.sort(key=lambda item: item["confidence"], reverse=True)
        top = candidates[0] if candidates else {"column": None, "confidence": 0}
        selected = top["column"] if top["confidence"] >= settings.role_confidence_threshold else None
        roles[role] = {"column": selected, "confidence": top["confidence"], "candidates": candidates[:3]}
    return roles


def module_availability(
    roles: dict[str, dict[str, JsonValue]]
) -> dict[str, dict[str, JsonValue]]:
    def role_col(role: str) -> str | None:
        data = roles.get(role) or {}
        return data.get("column")

    modules = {
        "kpis": ["revenue"],
        "time_series": ["timestamp", "revenue"],
        "revenue_by_category": ["category", "revenue"],
        "payment_analysis": ["payment_method", "revenue"],
        "returns": ["return_status"],
        "purchase_frequency": ["customer_id"],
        "segmentation": ["customer_id", "revenue"],
        "customer_segmentation": ["customer_id", "revenue", "timestamp"],
        "clv": ["customer_id", "revenue"],
        "recommendations": ["product_id"],
        "anomalies": ["revenue"],
    }
    availability: dict[str, dict[str, JsonValue]] = {}
    for key, required in modules.items():
        detected = {role: role_col(role) for role in required}
        availability[key] = {
            "enabled": all(bool(value) for value in detected.values()),
            "required": required,
            "detected": detected,
        }
    return availability
