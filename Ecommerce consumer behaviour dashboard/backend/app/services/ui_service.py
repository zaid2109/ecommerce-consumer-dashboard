from __future__ import annotations

import copy
from datetime import datetime
import hashlib
import math
import re
import time
from urllib.parse import quote

from app.db.duckdb_manager import DuckDBManager
from app.services.storage_service import load_metadata
from app.utils.helpers import to_identifier

JsonPrimitive = str | int | float | bool | None
JsonValue = JsonPrimitive | dict[str, "JsonValue"] | list["JsonValue"]

_UI_CACHE: dict[str, tuple[float, dict[str, JsonValue]]] = {}
_UI_CACHE_TTL_SECONDS = 30.0


def _latest_dataset() -> dict[str, JsonValue] | None:
    metadata = load_metadata()
    if not metadata:
        return None
    latest = sorted(metadata.values(), key=lambda item: item.get("created_at", ""), reverse=True)[0]
    return latest if isinstance(latest, dict) else None


def _role(dataset: dict[str, JsonValue], key: str) -> str | None:
    return (dataset.get("roles", {}).get(key) or {}).get("column")


def _table(dataset: dict[str, JsonValue]) -> str:
    return dataset["tables"]["clean"]


def _dataset_signature(dataset: dict[str, JsonValue]) -> str:
    return "|".join(
        [
            str(dataset.get("dataset_id") or ""),
            str(dataset.get("created_at") or ""),
            str(dataset.get("row_count") or ""),
            str((dataset.get("tables") or {}).get("clean") or ""),
        ]
    )


def _cache_get(key: str) -> dict[str, JsonValue] | None:
    hit = _UI_CACHE.get(key)
    if not hit:
        return None
    expires_at, payload = hit
    if time.time() >= expires_at:
        _UI_CACHE.pop(key, None)
        return None
    return copy.deepcopy(payload)


def _cache_set(key: str, payload: dict[str, JsonValue]) -> None:
    _UI_CACHE[key] = (time.time() + _UI_CACHE_TTL_SECONDS, copy.deepcopy(payload))


def _pick_column(
    dataset: dict[str, JsonValue],
    patterns: list[str],
    inferred_types: set[str] | None = None,
    exclude: list[str] | None = None,
) -> str | None:
    for column in dataset.get("schema", []):
        name = str(column.get("name", ""))
        lower = name.lower()
        if exclude:
            excluded = False
            for ex in exclude:
                if ex in lower:
                    excluded = True
                    break
            if excluded:
                continue
        matched = False
        for pattern in patterns:
            if re.search(pattern, lower):
                matched = True
                break
        if not matched:
            continue
        if inferred_types and column.get("inferred_type") not in inferred_types:
            continue
        return name
    return None


def _format_currency(value: float) -> str:
    return f"${value:,.2f}"


def _delta_style(change: float) -> tuple[str, str, bool, float]:
    increased = change >= 0
    magnitude = abs(change)
    if increased:
        delta_type = "increase" if magnitude >= 0.1 else "moderateIncrease"
    else:
        delta_type = "decrease" if magnitude >= 0.1 else "moderateDecrease"
    delta = f"{change * 100:.1f}%"
    return delta, delta_type, increased, round(magnitude * 100, 1)


def _avatar_data_url(seed: str) -> str:
    palette = ["#0ea5e9", "#22c55e", "#a855f7", "#f97316", "#ef4444", "#14b8a6"]
    digest = hashlib.md5(seed.encode("utf-8")).hexdigest()
    color = palette[int(digest, 16) % len(palette)]
    parts = [part for part in re.split(r"\s+", seed.strip()) if part]
    initials = "".join(part[0].upper() for part in parts[:2]) or "U"
    svg = (
        "<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'>"
        f"<rect width='64' height='64' fill='{color}' rx='12'/>"
        f"<text x='50%' y='52%' dominant-baseline='middle' text-anchor='middle' "
        "font-family='Inter, Arial, sans-serif' font-size='26' fill='white'>"
        f"{initials}</text></svg>"
    )
    return "data:image/svg+xml;utf8," + quote(svg)


def _split_name(value: str) -> tuple[str, str]:
    parts = [part for part in re.split(r"\s+", value.strip()) if part]
    if not parts:
        return "", ""
    if len(parts) == 1:
        return parts[0], ""
    return parts[0], " ".join(parts[1:])


def get_customers(limit: int = 200) -> dict[str, JsonValue]:
    dataset = _latest_dataset()
    if not dataset:
        return {"items": []}
    cache_key = f"customers:{_dataset_signature(dataset)}:{max(1, min(limit, 2000))}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached
    customer_col = _role(dataset, "customer_id") or _pick_column(
        dataset, ["customer", "client", "buyer", "user", "dim_customer_key", "customer_id"]
    )
    if not customer_col:
        return {"items": []}
    first_name_col = _pick_column(dataset, ["first_name", "firstname", r"\bfirst\b"])
    last_name_col = _pick_column(dataset, ["last_name", "lastname", r"\blast\b"])
    name_col = _pick_column(dataset, ["name"], exclude=["product", "item"])
    city_col = _pick_column(dataset, ["city", "town"]) or _role(dataset, "category")
    country_col = _pick_column(dataset, ["country", "nation"])
    phone_col = _pick_column(dataset, ["phone", "mobile", "contact"])
    revenue_col = _role(dataset, "revenue")
    table = _table(dataset)
    select_parts = [
        f"cast({to_identifier(customer_col)} as varchar) as customer_id",
        f"max(cast({to_identifier(first_name_col)} as varchar)) as first_name" if first_name_col else "null as first_name",
        f"max(cast({to_identifier(last_name_col)} as varchar)) as last_name" if last_name_col else "null as last_name",
        f"max(cast({to_identifier(name_col)} as varchar)) as full_name" if name_col else "null as full_name",
        f"max(cast({to_identifier(city_col)} as varchar)) as city" if city_col else "null as city",
        f"max(cast({to_identifier(country_col)} as varchar)) as country" if country_col else "null as country",
        f"max(cast({to_identifier(phone_col)} as varchar)) as phone" if phone_col else "null as phone",
        f"count(*) as orders",
        f"coalesce(sum({to_identifier(revenue_col)}), 0) as total_revenue" if revenue_col else "0 as total_revenue",
    ]
    order_by = "total_revenue desc" if revenue_col else "orders desc"
    rows = DuckDBManager.instance().fetch_all(
        f"""
        select {", ".join(select_parts)}
        from {to_identifier(table)}
        group by 1
        order by {order_by}
        limit {max(1, min(limit, 2000))}
        """
    )
    items: list[dict[str, JsonValue]] = []
    for row in rows:
        customer_id = row.get("customer_id") or ""
        first_name = row.get("first_name") or ""
        last_name = row.get("last_name") or ""
        full_name = row.get("full_name") or ""
        if not first_name and not last_name and full_name:
            first_name, last_name = _split_name(str(full_name))
        if not first_name and not last_name:
            suffix = str(customer_id)[-4:] if customer_id else ""
            first_name = "Customer"
            last_name = suffix
        name_seed = f"{first_name} {last_name}".strip() or str(customer_id)
        items.append(
            {
                "photo": _avatar_data_url(name_seed),
                "firstName": first_name,
                "lastName": last_name,
                "city": row.get("city") or "",
                "country": row.get("country") or "",
                "phone": row.get("phone") or "",
                "totalBuys": float(row.get("total_revenue") or 0),
            }
        )
    payload = {"items": items}
    _cache_set(cache_key, payload)
    return payload


def get_products(limit: int = 200) -> dict[str, JsonValue]:
    dataset = _latest_dataset()
    if not dataset:
        return {"items": []}
    cache_key = f"products:{_dataset_signature(dataset)}:{max(1, min(limit, 500))}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached
    product_col = _role(dataset, "product_id") or _pick_column(
        dataset, ["product", "sku", "item", "product_id"]
    )
    if not product_col:
        return {"items": []}
    name_col = _pick_column(dataset, ["product_name", "item_name", r"\bname\b"], exclude=["customer"])
    type_col = _role(dataset, "category") or _pick_column(dataset, ["category", "type", "segment"])
    revenue_col = _role(dataset, "revenue")
    quantity_col = _role(dataset, "quantity")
    table = _table(dataset)
    select_parts = [
        f"cast({to_identifier(product_col)} as varchar) as product_id",
        f"max(cast({to_identifier(name_col)} as varchar)) as product_name" if name_col else "null as product_name",
        f"max(cast({to_identifier(type_col)} as varchar)) as product_type" if type_col else "null as product_type",
        f"coalesce(sum({to_identifier(revenue_col)}), 0) as revenue" if revenue_col else "0 as revenue",
        f"coalesce(sum({to_identifier(quantity_col)}), 0) as quantity" if quantity_col else "0 as quantity",
        "count(*) as orders",
    ]
    rows = DuckDBManager.instance().fetch_all(
        f"""
        select {", ".join(select_parts)}
        from {to_identifier(table)}
        group by 1
        order by revenue desc, orders desc
        limit {max(1, min(limit, 500))}
        """
    )
    totals_row = DuckDBManager.instance().fetch_one(
        f"""
        select count(*) as total_orders,
               {f"coalesce(sum({to_identifier(revenue_col)}), 0)" if revenue_col else "0"} as total_revenue,
               {f"coalesce(sum({to_identifier(quantity_col)}), 0)" if quantity_col else "0"} as total_quantity
        from {to_identifier(table)}
        """
    ) or {"total_orders": 0, "total_revenue": 0, "total_quantity": 0}
    total_orders = max(1, int(totals_row.get("total_orders") or 1))
    total_revenue = float(totals_row.get("total_revenue") or 0)
    total_quantity = float(totals_row.get("total_quantity") or 0)
    overall_avg_price = (
        total_revenue / total_quantity
        if total_quantity > 0
        else total_revenue / max(1, total_orders)
    )
    items: list[dict[str, JsonValue]] = []
    device_types = ["Phone", "Tablet", "Laptop"]
    for row in rows:
        product_id = row.get("product_id") or ""
        product_name = row.get("product_name") or f"Product {product_id}"
        type_seed = hashlib.md5(str(product_id).encode("utf-8")).hexdigest()
        product_type = row.get("product_type") or device_types[int(type_seed, 16) % len(device_types)]
        revenue = float(row.get("revenue") or 0)
        quantity = float(row.get("quantity") or 0)
        orders = int(row.get("orders") or 0)
        avg_price = revenue / quantity if quantity > 0 else revenue / max(1, orders)
        parameters = [
            {"title": "Orders", "value": f"{orders}"},
            {"title": "Units Sold", "value": f"{int(quantity)}"},
            {"title": "Total Revenue", "value": _format_currency(revenue)},
            {"title": "Avg Price", "value": _format_currency(avg_price)},
        ]
        metrics = [
            {"title": "Order Share", "firstValue": orders, "secondValue": total_orders},
            {
                "title": "Revenue Share",
                "firstValue": round(revenue, 2),
                "secondValue": round(total_revenue, 2) if total_revenue > 0 else 1,
            },
            {
                "title": "Units Share",
                "firstValue": int(quantity),
                "secondValue": int(total_quantity) if total_quantity > 0 else 1,
            },
            {
                "title": "Avg Price vs Overall",
                "firstValue": round(avg_price, 2),
                "secondValue": round(overall_avg_price, 2) if overall_avg_price > 0 else 1,
            },
        ]
        image = "/phone.png" if product_type.lower().startswith("phone") else "/tablet.png" if product_type.lower().startswith("tablet") else "/laptop.png"
        items.append(
            {
                "productId": product_id,
                "name": product_name,
                "price": round(avg_price, 2),
                "type": product_type,
                "image": image,
                "parameters": parameters,
                "metrics": metrics,
            }
        )
    payload = {"items": items}
    _cache_set(cache_key, payload)
    return payload


def get_events(limit: int = 120) -> dict[str, JsonValue]:
    dataset = _latest_dataset()
    if not dataset:
        return {"items": []}
    cache_key = f"events:{_dataset_signature(dataset)}:{max(1, min(limit, 365))}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached
    ts_col = _role(dataset, "timestamp") or _pick_column(dataset, ["date", "time", "timestamp"])
    if not ts_col:
        return {"items": []}
    table = _table(dataset)
    ts_expr = f"try_cast({to_identifier(ts_col)} as timestamp)"
    rows = DuckDBManager.instance().fetch_all(
        f"""
        select strftime(date_trunc('day', {ts_expr}), '%Y-%m-%d') as day,
               count(*) as orders
        from {to_identifier(table)}
        where {ts_expr} is not null
        group by 1
        order by 1 desc
        limit {max(1, min(limit, 365))}
        """
    )
    items = [
        {"id": f"evt_{row['day']}", "title": f"Orders: {int(row['orders'])}", "start": row["day"]}
        for row in rows
    ]
    payload = {"items": items}
    _cache_set(cache_key, payload)
    return payload


def get_homepage() -> dict[str, JsonValue]:
    dataset = _latest_dataset()
    if not dataset:
        return {"data": {}}
    cache_key = f"homepage:{_dataset_signature(dataset)}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached
    table = _table(dataset)
    ts_col = _role(dataset, "timestamp") or _pick_column(dataset, ["date", "time", "timestamp"])
    revenue_col = _role(dataset, "revenue")
    customer_col = _role(dataset, "customer_id")
    product_col = _role(dataset, "product_id")
    category_col = _role(dataset, "category")
    channel_col = _pick_column(dataset, ["channel", "purchase_channel", "sales_channel"])
    base_metrics = DuckDBManager.instance().fetch_one(
        f"""
        select
          {f"coalesce(sum({to_identifier(revenue_col)}), 0)" if revenue_col else "0"} as revenue,
          count(*) as orders,
          {f"count(distinct {to_identifier(customer_col)})" if customer_col else "0"} as customers
        from {to_identifier(table)}
        """
    ) or {"revenue": 0, "orders": 0, "customers": 0}
    series: list[dict[str, JsonValue]] = []
    if ts_col:
        ts_expr = f"try_cast({to_identifier(ts_col)} as timestamp)"
        series = DuckDBManager.instance().fetch_all(
            f"""
            select strftime(date_trunc('day', {ts_expr}), '%Y-%m-%d') as day,
                   {f"coalesce(sum({to_identifier(revenue_col)}), 0)" if revenue_col else "0"} as revenue,
                   count(*) as orders,
                   {f"count(distinct {to_identifier(customer_col)})" if customer_col else "0"} as customers
            from {to_identifier(table)}
            where {ts_expr} is not null
            group by 1
            order by 1
            """
        )
    recent_series = series[-30:] if series else []
    def sum_period(key: str, days: int) -> tuple[float, float]:
        if not recent_series:
            return float(base_metrics.get(key) or 0), float(base_metrics.get(key) or 0)
        tail = recent_series[-days:]
        prev = recent_series[-2 * days : -days] if len(recent_series) >= 2 * days else []
        return float(sum(float(item.get(key) or 0) for item in tail)), float(
            sum(float(item.get(key) or 0) for item in prev)
        )
    sales_now, sales_prev = sum_period("revenue", 7)
    orders_now, orders_prev = sum_period("orders", 7)
    customers_now, customers_prev = sum_period("customers", 7)
    profit_now, profit_prev = sales_now * 0.12, sales_prev * 0.12
    def build_card(
        title: str,
        current: float,
        previous: float,
        chart_key: str,
        color: str,
        change_text: str,
    ) -> dict[str, JsonValue]:
        change = (current - previous) / previous if previous else 0.0
        delta, delta_type, increased, change_value = _delta_style(change)
        chart = [
            {"date": row["day"], "metric": float(row.get(chart_key) or 0)} for row in recent_series[-14:]
        ] or [{"date": datetime.utcnow().strftime("%Y-%m-%d"), "metric": current}]
        return {
            "title": title,
            "metric": _format_currency(current) if title in {"Sales", "Profit"} else f"{int(current):,}",
            "metricPrev": _format_currency(previous) if title in {"Sales", "Profit"} else f"{int(previous):,}",
            "delta": delta,
            "deltaType": delta_type,
            "color": color,
            "increased": increased,
            "changeValue": change_value,
            "changeText": change_text,
            "chartData": chart,
        }
    home_small_cards = [
        build_card("Sales", sales_now, sales_prev, "revenue", "purple", "Last 3 weeks"),
        build_card("Profit", profit_now, profit_prev, "revenue", "cyan", "Last month"),
        build_card("Traffic", orders_now, orders_prev, "orders", "indigo", "Yesterday"),
        build_card("Customers", customers_now, customers_prev, "customers", "emerald", "Last week"),
    ]
    revenue_over_time: list[dict[str, JsonValue]] = []
    if recent_series:
        if channel_col and revenue_col and ts_col:
            ts_expr = f"try_cast({to_identifier(ts_col)} as timestamp)"
            channel_rows = DuckDBManager.instance().fetch_all(
                f"""
                select strftime(date_trunc('day', {ts_expr}), '%Y-%m-%d') as day,
                       cast({to_identifier(channel_col)} as varchar) as channel,
                       coalesce(sum({to_identifier(revenue_col)}), 0) as revenue
                from {to_identifier(table)}
                where {ts_expr} is not null
                group by 1,2
                order by 1
                """
            )
            buckets: dict[str, dict[str, float]] = {}
            for row in channel_rows:
                day = row["day"]
                channel = str(row.get("channel") or "").lower()
                buckets.setdefault(day, {"websiteSales": 0.0, "inStoreSales": 0.0})
                if "online" in channel or "web" in channel:
                    buckets[day]["websiteSales"] += float(row.get("revenue") or 0)
                else:
                    buckets[day]["inStoreSales"] += float(row.get("revenue") or 0)
            revenue_over_time = [
                {"date": day, "websiteSales": values["websiteSales"], "inStoreSales": values["inStoreSales"]}
                for day, values in list(buckets.items())[-30:]
            ]
        else:
            revenue_over_time = [
                {"date": row["day"], "websiteSales": float(row.get("revenue") or 0), "inStoreSales": 0}
                for row in recent_series
            ]
    region_source_col = _pick_column(dataset, ["country", "region", "location", "city"]) or category_col
    regions: list[dict[str, JsonValue]] = []
    if region_source_col and revenue_col:
        region_rows = DuckDBManager.instance().fetch_all(
            f"""
            select cast({to_identifier(region_source_col)} as varchar) as name,
                   coalesce(sum({to_identifier(revenue_col)}), 0) as sales
            from {to_identifier(table)}
            group by 1
            order by 2 desc
            limit 4
            """
        )
        for row in region_rows:
            name = row.get("name") or "Unknown"
            regions.append(
                {
                    "name": name,
                    "region": str(name).lower().replace(" ", ""),
                    "sales": float(row.get("sales") or 0),
                    "delta": "0%",
                    "deltaType": "moderateIncrease",
                }
            )
    best_selling_products: list[dict[str, JsonValue]] = []
    if product_col and revenue_col:
        best_rows = DuckDBManager.instance().fetch_all(
            f"""
            select cast({to_identifier(product_col)} as varchar) as name,
                   coalesce(sum({to_identifier(revenue_col)}), 0) as revenue
            from {to_identifier(table)}
            group by 1
            order by 2 desc
            limit 6
            """
        )
        best_selling_products = [
            {"name": row["name"], "profit": float(row["revenue"]) * 0.12, "revenue": float(row["revenue"])}
            for row in best_rows
        ]
    satisfaction: list[dict[str, JsonValue]] = []
    if category_col and revenue_col:
        sat_rows = DuckDBManager.instance().fetch_all(
            f"""
            select cast({to_identifier(category_col)} as varchar) as brand_name,
                   coalesce(sum({to_identifier(revenue_col)}), 0) as total_sales,
                   count(*) as orders
            from {to_identifier(table)}
            group by 1
            order by 2 desc
            limit 8
            """
        )
        max_sales = max([float(row.get("total_sales") or 0) for row in sat_rows], default=1.0)
        for row in sat_rows:
            score = 60 + (float(row.get("total_sales") or 0) / max_sales) * 40
            satisfaction.append(
                {
                    "brandName": row.get("brand_name") or "Unknown",
                    "customerSatisfaction": round(score, 1),
                    "totalSales": float(row.get("total_sales") or 0),
                    "numberOfOrders": int(row.get("orders") or 0),
                }
            )
    revenue_per_country: list[dict[str, JsonValue]] = []
    country_col = _pick_column(dataset, ["country", "nation", "location", "city"]) or category_col
    if country_col and revenue_col:
        country_rows = DuckDBManager.instance().fetch_all(
            f"""
            select cast({to_identifier(country_col)} as varchar) as name,
                   coalesce(sum({to_identifier(revenue_col)}), 0) as price
            from {to_identifier(table)}
            group by 1
            order by 2 desc
            limit 10
            """
        )
        revenue_per_country = [{"name": row["name"], "price": float(row["price"])} for row in country_rows]
    payload = {
        "data": {
            "homeSmallCards": home_small_cards,
            "revenueOverTime": revenue_over_time,
            "regions": regions,
            "bestSellingProducts": best_selling_products,
            "customerSatisfaction": satisfaction,
            "revenuePerCountry": revenue_per_country,
        }
    }
    _cache_set(cache_key, payload)
    return payload
