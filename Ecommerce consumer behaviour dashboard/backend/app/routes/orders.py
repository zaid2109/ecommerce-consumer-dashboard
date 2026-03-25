from __future__ import annotations

import re
import time

from fastapi import APIRouter, Query

from app.db.duckdb_manager import DuckDBManager
from app.models.schemas import ApiResponse
from app.services.storage_service import load_metadata
from app.utils.helpers import to_identifier


router = APIRouter(tags=["orders"])

JsonPrimitive = str | int | float | bool | None
JsonValue = JsonPrimitive | dict[str, "JsonValue"] | list["JsonValue"]

_ORDERS_CACHE: dict[str, tuple[float, dict[str, JsonValue]]] = {}


def _get_latest_dataset() -> dict[str, JsonValue]:
  metadata = load_metadata()
  if not metadata:
      raise ValueError("No datasets available")
  latest = sorted(
      metadata.values(), key=lambda d: d.get("created_at", ""), reverse=True
  )[0]
  return latest if isinstance(latest, dict) else {}


def _get_latest_clean_table() -> str:
  latest = _get_latest_dataset()
  tables = latest.get("tables", {})
  clean = tables.get("clean")
  if not clean:
      raise ValueError("No clean table configured for latest dataset")
  return clean


def _role(dataset: dict[str, JsonValue], key: str) -> str | None:
  return (dataset.get("roles", {}).get(key) or {}).get("column")


def _pick_column(dataset: dict[str, JsonValue], patterns: list[str]) -> str | None:
  schema = dataset.get("schema", [])
  if not isinstance(schema, list):
      return None
  for column in schema:
      if not isinstance(column, dict):
          continue
      name = str(column.get("name", ""))
      lower = name.lower()
      matched = False
      for pattern in patterns:
          if re.search(pattern, lower):
              matched = True
              break
      if matched:
          return name
  return None


def _cache_get(key: str) -> dict[str, JsonValue] | None:
  hit = _ORDERS_CACHE.get(key)
  if not hit:
      return None
  expires_at, payload = hit
  if time.time() >= expires_at:
      _ORDERS_CACHE.pop(key, None)
      return None
  return payload


@router.get("/orders", response_model=ApiResponse)
def list_orders(page: int = Query(1, ge=1), limit: int = Query(50, ge=1, le=500)) -> ApiResponse:
  dataset = _get_latest_dataset()
  clean_table = _get_latest_clean_table()
  dataset_signature = "|".join(
      [
          str(dataset.get("dataset_id") or ""),
          str(dataset.get("created_at") or ""),
          str(page),
          str(limit),
      ]
  )
  cached = _cache_get(dataset_signature)
  if cached is not None:
      return ApiResponse(data=cached)
  offset = (page - 1) * limit
  order_col = _role(dataset, "order_id") or _pick_column(dataset, [r"\border_id\b", r"\border\b", r"\binvoice\b"])
  if not order_col:
      return ApiResponse(data={"items": [], "page": page, "limit": limit})
  product_col = _role(dataset, "product_id") or _pick_column(dataset, [r"\bproduct_id\b", r"\bproduct\b", r"\bsku\b", r"\bitem\b"])
  customer_col = _role(dataset, "customer_id") or _pick_column(dataset, [r"\bcustomer_id\b", r"\bcustomer\b", r"\bbuyer\b", r"\bclient\b", r"\bdim_customer_key\b"])
  date_col = _role(dataset, "timestamp") or _pick_column(dataset, [r"\bdate\b", r"\btime\b", r"\btimestamp\b"])
  city_col = _pick_column(dataset, [r"\bcity\b", r"\blocation\b", r"\bregion\b", r"\bcountry\b"])
  quantity_col = _role(dataset, "quantity") or _pick_column(dataset, [r"\bquantity\b", r"\bqty\b", r"\bprocured\b"])
  revenue_col = _role(dataset, "revenue") or _pick_column(dataset, [r"\brevenue\b", r"\btotal\b", r"\bamount\b", r"\bprice\b"])
  unit_price_col = _pick_column(dataset, [r"\bunit_price\b", r"\bunit_selling_price\b", r"\bprice\b"])
  discount_col = _pick_column(dataset, [r"\bdiscount\b"])
  select_parts = [
      f"cast({to_identifier(order_col)} as varchar) as order_id",
      f"cast({to_identifier(product_col)} as varchar) as product_id" if product_col else "null as product_id",
      f"cast({to_identifier(customer_col)} as varchar) as customer_id" if customer_col else "null as customer_id",
      f"cast({to_identifier(city_col)} as varchar) as city_name" if city_col else "null as city_name",
      f"cast({to_identifier(date_col)} as varchar) as order_date" if date_col else "null as order_date",
      f"cast({to_identifier(quantity_col)} as double) as quantity" if quantity_col else "0 as quantity",
      f"cast({to_identifier(unit_price_col)} as double) as unit_price" if unit_price_col else "0 as unit_price",
      f"cast({to_identifier(discount_col)} as double) as discount" if discount_col else "0 as discount",
      f"cast({to_identifier(revenue_col)} as double) as revenue" if revenue_col else "0 as revenue",
  ]
  order_by = (
      f"try_cast({to_identifier(date_col)} as timestamp) desc"
      if date_col
      else f"{to_identifier(order_col)} desc"
  )

  db = DuckDBManager.instance()
  rows = db.fetch_all(
      f"""
      SELECT
        {", ".join(select_parts)}
      FROM {to_identifier(clean_table)}
      ORDER BY {order_by}
      LIMIT ? OFFSET ?
      """,
      [limit, offset],
  )

  payload: dict[str, JsonValue] = {
      "items": rows,
      "page": page,
      "limit": limit,
  }
  _ORDERS_CACHE[dataset_signature] = (time.time() + 20.0, payload)
  return ApiResponse(data=payload)
