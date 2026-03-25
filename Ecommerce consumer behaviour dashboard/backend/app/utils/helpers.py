from __future__ import annotations

import json
import re
import uuid
from pathlib import Path


JsonPrimitive = str | int | float | bool | None
JsonValue = JsonPrimitive | dict[str, "JsonValue"] | list["JsonValue"]


def normalize_column_name(name: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9]+", "_", name.strip().lower())
    cleaned = re.sub(r"_+", "_", cleaned).strip("_")
    return cleaned or f"col_{uuid.uuid4().hex[:8]}"


def normalize_columns(raw_columns: list[str]) -> dict[str, str]:
    renamed: dict[str, str] = {}
    used: set[str] = set()
    for raw in raw_columns:
        raw_text = str(raw)
        raw_lower = raw_text.strip().lower()
        normalized = normalize_column_name(raw_text)
        if raw_lower.startswith("unnamed"):
            continue
        if normalized in {"column1", "unnamed_0", "unnamed_0_1", "index", "row", "row_id"}:
            continue
        while normalized in used:
            normalized = f"{normalized}_x"
        used.add(normalized)
        renamed[raw_text] = normalized
    return renamed


def to_identifier(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def random_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex}"


def ensure_json(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        path.write_text("{}", encoding="utf-8")


def read_json(path: Path) -> dict[str, JsonValue]:
    ensure_json(path)
    parsed = json.loads(path.read_text(encoding="utf-8") or "{}")
    return parsed if isinstance(parsed, dict) else {}


def write_json(path: Path, data: dict[str, JsonValue]) -> None:
    ensure_json(path)
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")
