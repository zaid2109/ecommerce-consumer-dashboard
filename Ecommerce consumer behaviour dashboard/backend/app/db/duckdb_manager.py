from __future__ import annotations

import threading
from pathlib import Path

import duckdb

from app.config import settings


class DuckDBManager:
    _instance: "DuckDBManager | None" = None
    _lock = threading.Lock()

    def __init__(self, db_path: Path):
        db_path.parent.mkdir(parents=True, exist_ok=True)
        self.conn = duckdb.connect(str(db_path))
        self.conn.execute("pragma threads=4")

    @classmethod
    def instance(cls) -> "DuckDBManager":
        if cls._instance:
            return cls._instance
        with cls._lock:
            if cls._instance is None:
                cls._instance = DuckDBManager(settings.db_path)
        return cls._instance

    def execute(self, sql: str, params: list[object] | None = None) -> None:
        if params is None:
            self.conn.execute(sql)
            return
        self.conn.execute(sql, params)

    def fetch_all(
        self, sql: str, params: list[object] | None = None
    ) -> list[dict[str, object]]:
        if params is None:
            result = self.conn.execute(sql)
        else:
            result = self.conn.execute(sql, params)
        columns = [col[0] for col in result.description]
        return [dict(zip(columns, row)) for row in result.fetchall()]

    def fetch_one(
        self, sql: str, params: list[object] | None = None
    ) -> dict[str, object] | None:
        rows = self.fetch_all(sql, params)
        return rows[0] if rows else None
