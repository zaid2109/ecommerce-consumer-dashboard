from __future__ import annotations

import hashlib
import uuid
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.ensemble import IsolationForest, RandomForestRegressor
from sklearn.metrics.pairwise import cosine_similarity

from app.db.duckdb_manager import DuckDBManager
from app.services.cache import get_cache, set_cache
from app.services.enhanced_rfm_service import get_enhanced_rfm_data
from app.services.payment_analysis_service import get_payment_analysis_data
from app.services.circuit_breaker_service import get_module_breaker
from app.services.timeout_service import timeout
from app.utils.helpers import to_identifier

MAX_ANOMALY_ROWS = 60000
MAX_SEGMENTATION_ROWS = 50000
MAX_CLV_ROWS = 40000
MAX_RECOMMENDATION_INTERACTIONS = 120000
MAX_RECOMMENDATION_USERS = 120
MAX_RECOMMENDATION_PRODUCTS = 300

JsonPrimitive = str | int | float | bool | None
JsonValue = JsonPrimitive | dict[str, "JsonValue"] | list["JsonValue"]


DEFAULT_ANALYTICS_CACHE_TTL_SECONDS = 600


def _dataset_hash(dataset: dict[str, JsonValue]) -> str:
    seed = "|".join(
        [
            str(dataset.get("tenant_id") or ""),
            str(dataset.get("dataset_id") or ""),
            str(dataset.get("source_file_path") or ""),
            str(dataset.get("row_count") or ""),
        ]
    )
    return hashlib.sha256(seed.encode("utf-8")).hexdigest()[:12]


def _cache_key(dataset: dict[str, JsonValue], module_name: str, version_id: str | None = None) -> str:
    base_key = f"{_dataset_hash(dataset)}_{module_name}"
    if version_id:
        return f"{base_key}_v{version_id}"
    return base_key


def _dataset_or_none(dataset_id: str, version_id: str | None = None, *, tenant_id: str | None = None) -> dict[str, JsonValue] | None:
    from app.services.storage_service import get_dataset
    return get_dataset(dataset_id, version_id=version_id, tenant_id=tenant_id)


def _role(dataset: dict[str, JsonValue], key: str) -> str | None:
    return (dataset.get("roles", {}).get(key) or {}).get("column")


def _table(dataset: dict[str, JsonValue]) -> str:
    return dataset["tables"]["clean"]


def _timestamp_expr(column: str) -> str:
    return f"try_cast({to_identifier(column)} as timestamp)"


def _apply_filters_sql(
    dataset: dict[str, JsonValue], filters: dict[str, object]
) -> tuple[str, list[object]]:
    clauses: list[str] = []
    params: list[object] = []
    ts = _role(dataset, "timestamp")
    cat = _role(dataset, "category")
    pay = _role(dataset, "payment_method")
    if filters.get("from_date") and ts:
        clauses.append(f"{_timestamp_expr(ts)} >= ?::TIMESTAMP")
        params.append(filters["from_date"])
    if filters.get("to_date") and ts:
        clauses.append(f"{_timestamp_expr(ts)} <= ?::TIMESTAMP")
        params.append(filters["to_date"])
    if filters.get("category") and cat:
        clauses.append(f"{to_identifier(cat)} = ?")
        params.append(filters["category"])
    if filters.get("payment_method") and pay:
        clauses.append(f"{to_identifier(pay)} = ?")
        params.append(filters["payment_method"])
    return ("where " + " and ".join(clauses)) if clauses else "", params


def _unique_values(dataset: dict[str, JsonValue], role_key: str, limit: int = 50) -> list[str]:
    column = _role(dataset, role_key)
    if not column:
        return []
    table = _table(dataset)
    rows = DuckDBManager.instance().fetch_all(
        f"""
        select cast({to_identifier(column)} as varchar) as value
        from {to_identifier(table)}
        where {to_identifier(column)} is not null
        group by 1
        order by count(*) desc
        limit {max(1, min(limit, 200))}
        """
    )
    return [row["value"] for row in rows if row.get("value")]


def get_table(
    dataset_id: str, page: int, limit: int, filters: dict[str, object], version_id: str | None = None, *, tenant_id: str | None = None
) -> dict[str, JsonValue] | None:
    dataset = _dataset_or_none(dataset_id, version_id=version_id, tenant_id=tenant_id)
    if not dataset:
        return None
    table = _table(dataset)
    where_sql, params = _apply_filters_sql(dataset, filters)
    safe_page = max(1, int(page))
    safe_limit = max(1, min(int(limit), 200))
    offset = (safe_page - 1) * safe_limit
    rows = DuckDBManager.instance().fetch_all(
        f"""
        select * from {to_identifier(table)} {where_sql}
        limit ? offset ?
        """,
        params + [safe_limit, offset],
    )
    total_row = DuckDBManager.instance().fetch_one(
        f"""
        select count(*) as cnt
        from {to_identifier(table)} {where_sql}
        """,
        params,
    )
    total = int(total_row.get("cnt", 0)) if total_row else 0
    return {
        "status": "ok",
        "data": {
            "items": rows,
            "page": safe_page,
            "limit": safe_limit,
            "total": total,
        },
    }


def _module_unavailable(
    reason: str, required: list[str], dataset: dict[str, JsonValue]
) -> dict[str, JsonValue]:
    return {
        "status": "unavailable",
        "reason": reason,
        "required": required,
        "detected": {key: _role(dataset, key) for key in required},
    }


def _cap_frame(frame: pd.DataFrame, max_rows: int) -> pd.DataFrame:
    if len(frame) <= max_rows:
        return frame
    return frame.sample(n=max_rows, random_state=42)


def get_metrics(dataset_id: str, filters: dict[str, object], version_id: str | None = None, *, tenant_id: str | None = None) -> dict[str, JsonValue] | None:
    dataset = _dataset_or_none(dataset_id, version_id=version_id, tenant_id=tenant_id)
    if not dataset:
        return None
    rev = _role(dataset, "revenue")
    if not rev:
        return _module_unavailable("Missing revenue column", ["revenue"], dataset)
    where_sql, params = _apply_filters_sql(dataset, filters)
    table = _table(dataset)
    order = _role(dataset, "order_id")

    db = DuckDBManager.instance()
    tmp = f"tmp_kpis_{dataset_id}_{uuid.uuid4().hex[:8]}"
    try:
        order_expr = to_identifier(order) if order else "null"
        db.execute(
            f"""
            create temp table {to_identifier(tmp)} as
            select
              {to_identifier(rev)} as revenue,
              {order_expr} as order_id
            from {to_identifier(table)} {where_sql}
            """,
            params,
        )

        rows = db.fetch_all(
            f"""
            select
              coalesce(sum(revenue), 0) as total_revenue,
              {"count(distinct order_id)" if order else "count(*)"} as total_orders,
              coalesce(sum(revenue) / greatest(1, {"count(distinct order_id)" if order else "count(*)"}), 0) as avg_order_value
            from {to_identifier(tmp)}
            """
        )
    finally:
        db.execute(f"drop table if exists {to_identifier(tmp)}")
    return {"status": "ok", "data": rows[0] if rows else {}}


def get_revenue_by_category(
    dataset_id: str, filters: dict[str, object], top: int = 20, version_id: str | None = None, *, tenant_id: str | None = None
) -> dict[str, JsonValue] | None:
    dataset = _dataset_or_none(dataset_id, version_id=version_id, tenant_id=tenant_id)
    if not dataset:
        return None
    rev = _role(dataset, "revenue")
    cat = _role(dataset, "category")
    if not rev or not cat:
        return _module_unavailable("Missing category or revenue column", ["category", "revenue"], dataset)
    where_sql, params = _apply_filters_sql(dataset, filters)
    table = _table(dataset)
    rows = DuckDBManager.instance().fetch_all(
        f"""
        select cast({to_identifier(cat)} as varchar) as category, coalesce(sum({to_identifier(rev)}), 0) as revenue
        from {to_identifier(table)} {where_sql}
        group by 1 order by 2 desc limit {max(1, min(top, 100))}
        """,
        params,
    )
    return {"status": "ok", "data": rows}


def get_time_series(dataset_id: str, filters: dict[str, object], version_id: str | None = None, *, tenant_id: str | None = None) -> dict[str, JsonValue] | None:
    dataset = _dataset_or_none(dataset_id, version_id=version_id, tenant_id=tenant_id)
    if not dataset:
        return None
    rev = _role(dataset, "revenue")
    ts = _role(dataset, "timestamp")
    granularity = filters.get("granularity", "day")
    if granularity not in {"day", "week", "month"}:
        granularity = "day"
    if not rev or not ts:
        return _module_unavailable("Missing timestamp or revenue column", ["timestamp", "revenue"], dataset)
    where_sql, params = _apply_filters_sql(dataset, filters)
    table = _table(dataset)

    db = DuckDBManager.instance()
    tmp = f"tmp_timeseries_{dataset_id}_{uuid.uuid4().hex[:8]}"
    try:
        db.execute(
            f"""
            create temp table {to_identifier(tmp)} as
            select
              {_timestamp_expr(ts)} as ts,
              {to_identifier(rev)} as revenue
            from {to_identifier(table)} {where_sql}
            """,
            params,
        )

        rows = db.fetch_all(
            f"""
            select strftime(date_trunc('{granularity}', ts), '%Y-%m-%d') as bucket,
                   coalesce(sum(revenue), 0) as revenue
            from {to_identifier(tmp)}
            where ts is not null
            group by 1 order by 1
            """
        )
    finally:
        db.execute(f"drop table if exists {to_identifier(tmp)}")
    return {"status": "ok", "data": rows}


def get_payment_analysis(
    dataset_id: str, filters: dict[str, object], version_id: str | None = None, *, tenant_id: str | None = None
) -> dict[str, JsonValue] | None:
    dataset = _dataset_or_none(dataset_id, version_id=version_id, tenant_id=tenant_id)
    if not dataset:
        return None
    rev = _role(dataset, "revenue")
    pay = _role(dataset, "payment_method")
    pay_status = _role(dataset, "payment_status")
    if not rev or not pay:
        return _module_unavailable("Missing payment method or revenue column", ["payment_method", "revenue"], dataset)
    where_sql, params = _apply_filters_sql(dataset, filters)
    table = _table(dataset)
    success_expr = (
        f"sum(case when lower(cast({to_identifier(pay_status)} as varchar)) in ('success','succeeded','paid','true','1','yes') then 1 else 0 end)"
        if pay_status
        else "0"
    )
    failure_expr = (
        f"sum(case when lower(cast({to_identifier(pay_status)} as varchar)) in ('failed','failure','declined','false','0','no') then 1 else 0 end)"
        if pay_status
        else "0"
    )
    rows = DuckDBManager.instance().fetch_all(
        f"""
        select cast({to_identifier(pay)} as varchar) as payment_method,
               coalesce(sum({to_identifier(rev)}),0) as revenue,
               count(*) as orders,
               {success_expr} as success_count,
               {failure_expr} as failure_count
        from {to_identifier(table)} {where_sql}
        group by 1 order by 2 desc
        """,
        params,
    )
    for row in rows:
        total = max(1, int(row["orders"]))
        row["success_rate"] = float(row["success_count"]) / total
    return {"status": "ok", "data": rows}


def get_returns(dataset_id: str, filters: dict[str, object], version_id: str | None = None, *, tenant_id: str | None = None) -> dict[str, JsonValue] | None:
    dataset = _dataset_or_none(dataset_id, version_id=version_id, tenant_id=tenant_id)
    if not dataset:
        return None
    ret = _role(dataset, "return_status")
    rev = _role(dataset, "revenue")
    ref = _role(dataset, "refund_amount")
    cat = _role(dataset, "category")
    if not ret:
        return _module_unavailable("Missing return status column", ["return_status"], dataset)
    where_sql, params = _apply_filters_sql(dataset, filters)
    table = _table(dataset)
    by_status = DuckDBManager.instance().fetch_all(
        f"""
        select cast({to_identifier(ret)} as varchar) as return_status, count(*) as count,
               {f"coalesce(sum({to_identifier(ref)}),0)" if ref else "0"} as refund_amount
        from {to_identifier(table)} {where_sql}
        group by 1 order by 2 desc
        """,
        params,
    )
    return_rate_by_category = []
    if cat:
        return_rate_by_category = DuckDBManager.instance().fetch_all(
            f"""
            select cast({to_identifier(cat)} as varchar) as category,
                   sum(case when lower(cast({to_identifier(ret)} as varchar)) in ('true','1','yes','returned','refund','refunded') then 1 else 0 end) as returned,
                   count(*) as total
            from {to_identifier(table)} {where_sql}
            group by 1
            order by returned desc
            """,
            params,
        )
        for row in return_rate_by_category:
            row["return_rate"] = float(row["returned"]) / max(1, int(row["total"]))
    high_return_products = []
    prod = _role(dataset, "product_id")
    if prod:
        high_return_products = DuckDBManager.instance().fetch_all(
            f"""
            select cast({to_identifier(prod)} as varchar) as product_id,
                   sum(case when lower(cast({to_identifier(ret)} as varchar)) in ('true','1','yes','returned','refund','refunded') then 1 else 0 end) as returned
            from {to_identifier(table)} {where_sql}
            group by 1 order by returned desc limit 30
            """,
            params,
        )
    return {"status": "ok", "data": {"by_status": by_status, "return_rate_by_category": return_rate_by_category, "high_return_products": high_return_products}}


def get_purchase_frequency(dataset_id: str, filters: dict[str, object], version_id: str | None = None, *, tenant_id: str | None = None) -> dict[str, JsonValue] | None:
    dataset = _dataset_or_none(dataset_id, version_id=version_id, tenant_id=tenant_id)
    if not dataset:
        return None
    customer = _role(dataset, "customer_id")
    ts = _role(dataset, "timestamp")
    if not customer:
        return _module_unavailable("Missing customer_id column", ["customer_id"], dataset)
    where_sql, params = _apply_filters_sql(dataset, filters)
    table = _table(dataset)
    repeat_vs_new = DuckDBManager.instance().fetch_one(
        f"""
        with customer_orders as (
          select cast({to_identifier(customer)} as varchar) as customer_id, count(*) as orders
          from {to_identifier(table)} {where_sql}
          group by 1
        )
        select sum(case when orders > 1 then 1 else 0 end) as repeat_customers,
               sum(case when orders = 1 then 1 else 0 end) as new_customers
        from customer_orders
        """,
        params,
    ) or {}
    distribution = DuckDBManager.instance().fetch_all(
        f"""
        with customer_orders as (
          select cast({to_identifier(customer)} as varchar) as customer_id, count(*) as orders
          from {to_identifier(table)} {where_sql}
          group by 1
        )
        select orders, count(*) as customers
        from customer_orders
        group by 1 order by 1
        """,
        params,
    )
    trend = []
    if ts:
        trend = DuckDBManager.instance().fetch_all(
            f"""
            with period_customer_orders as (
              select strftime(date_trunc('day', {_timestamp_expr(ts)}), '%Y-%m-%d') as bucket,
                     cast({to_identifier(customer)} as varchar) as customer_id,
                     count(*) as orders
              from {to_identifier(table)} {where_sql}
              group by 1, 2
            )
            select bucket, sum(orders) as orders,
                   sum(case when orders > 1 then 1 else 0 end) as repeat_customers,
                   sum(case when orders = 1 then 1 else 0 end) as new_customers
            from period_customer_orders
            group by 1 order by 1
            """,
            params,
        )
    return {"status": "ok", "data": {"repeat_vs_new": repeat_vs_new, "orders_per_user_distribution": distribution, "trend": trend}}


def get_segmentation(dataset_id: str, filters: dict[str, object], version_id: str | None = None, *, tenant_id: str | None = None) -> dict[str, JsonValue] | None:
    from app.services.job_service import find_duplicate_job, create_job, JobType, complete_job, fail_job
    
    # Check for duplicate processing
    duplicate_job = find_duplicate_job(JobType.ANALYTICS_COMPUTATION, tenant_id, dataset_id, version_id, {"module": "segmentation", "filters": filters})
    if duplicate_job:
        # Return job status if duplicate is running
        return {"status": "processing", "job_id": duplicate_job.job_id, "progress": duplicate_job.progress}
    
    dataset = _dataset_or_none(dataset_id, version_id=version_id, tenant_id=tenant_id)
    if not dataset:
        return None

    cache_key = _cache_key(dataset, "segmentation", version_id)
    cached = get_cache(cache_key, tenant_id=dataset.get("tenant_id"))
    if cached is not None:
        return cached

    # Create job for tracking
    job = create_job(JobType.ANALYTICS_COMPUTATION, tenant_id, dataset_id, version_id, {"module": "segmentation", "filters": filters})
    
    breaker = get_module_breaker("segmentation")
    try:
        job.start()
        job.update_progress(25.0)
        
        result = breaker.call(
            timeout(25.0)(_compute_segmentation),
            dataset,
            filters,
        )
        
        job.update_progress(90.0)
        set_cache(cache_key, result, DEFAULT_ANALYTICS_CACHE_TTL_SECONDS, tenant_id=dataset.get("tenant_id"))
        
        job.update_progress(100.0)
        complete_job(job.job_id, result)
        
        return result
    except Exception as exc:
        error_msg = f"Segmentation failed: {str(exc)}"
        payload = _module_unavailable(error_msg, ["revenue", "orders", "customers"], dataset)
        
        set_cache(cache_key, payload, 60, tenant_id=dataset.get("tenant_id"))  # Short cache on error
        fail_job(job.job_id, error_msg)
        
        return payload


def _compute_segmentation(dataset: dict[str, JsonValue], filters: dict[str, object]) -> dict[str, JsonValue]:
    """Internal segmentation computation without caching/circuit breaker."""
    customer = _role(dataset, "customer_id")
    revenue = _role(dataset, "revenue")
    ts = _role(dataset, "timestamp")
    if not customer or not revenue:
        return _module_unavailable(
            "Customer and revenue columns required", ["revenue", "orders", "customers"], dataset
        )
    
    db = DuckDBManager.instance()
    clean_table = (dataset.get("tables") or {}).get("clean")
    if not clean_table:
        return _module_unavailable("Clean table not found", ["revenue", "orders", "customers"], dataset)
    
    # Use streaming queries to avoid loading full dataset
    try:
        # Get counts with streaming - only aggregate, no full data load
        repeat_vs_new = db.fetch_one(f"""
            select 
                sum(case when order_count > 1 then 1 else 0 end) as repeat_customers,
                sum(case when order_count = 1 then 1 else 0 end) as new_customers,
                count(*) as total_customers
            from (
                select 
                    {to_identifier(customer)} as customer_id,
                    count(*) as order_count
                from {to_identifier(clean_table)}
                where {to_identifier(revenue)} is not null
                group by 1
            )
        """)
        
        # Get distribution with streaming - only aggregated data
        distribution = db.fetch_all(f"""
            select 
                order_count as orders,
                count(*) as customers
            from (
                select 
                    {to_identifier(customer)} as customer_id,
                    count(*) as order_count
                from {to_identifier(clean_table)}
                where {to_identifier(revenue)} is not null
                group by 1
            )
            where order_count <= 10  -- Limit to reasonable range
            group by 1
            order by 1
        """)
        
        # Get trend with streaming - only aggregated time series data
        if ts:
            trend = db.fetch_all(f"""
                select 
                    date_trunc('month', {to_identifier(ts)}) as month,
                    sum(case when order_count > 1 then 1 else 0 end) as repeat_customers,
                    sum(case when order_count = 1 then 1 else 0 end) as new_customers
                from (
                    select 
                        {to_identifier(customer)} as customer_id,
                        {to_identifier(ts)} as order_ts,
                        count(*) over (partition by {to_identifier(customer)}) as order_count
                    from {to_identifier(clean_table)}
                    where {to_identifier(revenue)} is not null and {to_identifier(ts)} is not null
                )
                group by 1
                order by 1
                limit 24  -- Last 24 months max
            """)
        else:
            trend = []
        
        return {
            "status": "ok",
            "data": {
                "repeat_vs_new": repeat_vs_new or {},
                "orders_per_user_distribution": distribution or [],
                "trend": trend or [],
            },
        }
    except Exception as exc:
        return _module_unavailable(f"Segmentation computation failed: {str(exc)}", ["revenue", "orders", "customers"], dataset)

def _compute_clv(dataset_id: str, filters: dict[str, object], version_id: str | None = None, *, tenant_id: str | None = None) -> dict[str, JsonValue]:
    segmentation = get_segmentation(dataset_id, filters, version_id=version_id, tenant_id=tenant_id)
    if not segmentation or segmentation.get("status") != "ok":
        return segmentation
    points = segmentation["data"].get("points", [])
    if len(points) < 5:
        return {"status": "ok", "data": {"predictions": [], "feature_importance": []}}
    frame = pd.DataFrame(points)
    frame = _cap_frame(frame, MAX_CLV_ROWS)
    x = frame[["frequency", "monetary", "recency_days"]].astype(float)
    y = frame["monetary"].astype(float) * (1 + frame["frequency"].astype(float) / max(1.0, frame["frequency"].max()))
    model = RandomForestRegressor(n_estimators=120, random_state=42)
    model.fit(x, y)
    frame["predicted_clv"] = model.predict(x)
    imp = [{"feature": col, "importance": float(val)} for col, val in zip(x.columns, model.feature_importances_)]
    pred = frame.sort_values("predicted_clv", ascending=False)[["customer_id", "predicted_clv", "segment"]].head(300).to_dict(orient="records")
    return {"status": "ok", "data": {"predictions": pred, "feature_importance": imp}}


def get_recommendations(dataset_id: str, filters: dict[str, object], version_id: str | None = None, *, tenant_id: str | None = None) -> dict[str, JsonValue] | None:
    dataset = _dataset_or_none(dataset_id, version_id=version_id, tenant_id=tenant_id)
    if not dataset:
        return None
    customer = _role(dataset, "customer_id")
    product = _role(dataset, "product_id")
    if not product:
        return _module_unavailable("Missing product_id column", ["product_id"], dataset)

    breaker = get_module_breaker("recommendations")
    try:
        result = breaker.call(
            timeout(25.0)(_compute_recommendations),
            dataset,
            filters,
        )
        return result
    except Exception as exc:
        return {"status": "error", "reason": f"Recommendations failed: {str(exc)}"}

def _compute_recommendations(dataset: dict[str, JsonValue], filters: dict[str, object]) -> dict[str, JsonValue]:
    """Internal recommendations computation without caching/circuit breaker."""
    where_sql, params = _apply_filters_sql(dataset, filters)
    table = _table(dataset)
    db = DuckDBManager.instance()
    popular = db.fetch_all(
        f"""
        select cast({to_identifier(product)} as varchar) as product_id, count(*) as score
        from {to_identifier(table)} {where_sql}
        group by 1 order by 2 desc limit 20
        """,
        params,
    )
    if not customer:
        return {"status": "ok", "data": {"strategy": "popularity", "popular": popular, "recommendations": []}}
    interactions = db.fetch_all(
        f"""
        select cast({to_identifier(customer)} as varchar) as customer_id,
               cast({to_identifier(product)} as varchar) as product_id,
               count(*) as weight
        from {to_identifier(table)} {where_sql}
        group by 1,2
        order by weight desc
        limit {MAX_RECOMMENDATION_INTERACTIONS}
        """,
        params,
    )
    frame = pd.DataFrame(interactions)
    if frame.empty or frame["customer_id"].nunique() < 2:
        return {"status": "ok", "data": {"strategy": "popularity", "popular": popular, "recommendations": []}}
    top_customers = frame.groupby("customer_id")["weight"].sum().nlargest(MAX_RECOMMENDATION_USERS).index
    top_products = frame.groupby("product_id")["weight"].sum().nlargest(MAX_RECOMMENDATION_PRODUCTS).index
    frame = frame[frame["customer_id"].isin(top_customers) & frame["product_id"].isin(top_products)]
    if frame.empty or frame["customer_id"].nunique() < 2 or frame["product_id"].nunique() < 2:
        return {"status": "ok", "data": {"strategy": "popularity", "popular": popular, "recommendations": []}}
    matrix = frame.pivot_table(index="customer_id", columns="product_id", values="weight", fill_value=0)
    sims = cosine_similarity(matrix.values)
    sim_df = pd.DataFrame(sims, index=matrix.index, columns=matrix.index)
    recommendations = []
    for customer_id in matrix.index[:120]:
        nearest = sim_df[customer_id].sort_values(ascending=False).iloc[1:6].index
        candidate_scores = matrix.loc[nearest].sum(axis=0)
        owned = set(matrix.loc[customer_id][matrix.loc[customer_id] > 0].index.tolist())
        ranked = [(pid, float(score)) for pid, score in candidate_scores.items() if pid not in owned]
        ranked.sort(key=lambda x: x[1], reverse=True)
        recommendations.append({"customer_id": customer_id, "items": [{"product_id": pid, "score": score} for pid, score in ranked[:5]]})
    return {"status": "ok", "data": {"strategy": "collaborative", "popular": popular, "recommendations": recommendations}}


def get_customer_segmentation(dataset_id: str, filters: dict[str, object], version_id: str | None = None, *, tenant_id: str | None = None) -> dict[str, JsonValue] | None:
    """Get RFM customer segmentation results."""
    from app.services.rfm_service import compute_rfm_segmentation
    
    dataset = _dataset_or_none(dataset_id, version_id=version_id, tenant_id=tenant_id)
    if not dataset:
        return None
    
    return compute_rfm_segmentation(dataset_id, dataset, filters, version_id, tenant_id=tenant_id)


def get_anomalies(dataset_id: str, filters: dict[str, object], version_id: str | None = None, *, tenant_id: str | None = None) -> dict[str, JsonValue] | None:
    dataset = _dataset_or_none(dataset_id, version_id=version_id, tenant_id=tenant_id)
    if not dataset:
        return None

    cache_key = _cache_key(dataset, "anomalies", version_id)
    cached = get_cache(cache_key, tenant_id=dataset.get("tenant_id"))
    if cached is not None:
        return cached

    breaker = get_module_breaker("anomalies")
    try:
        result = breaker.call(
            timeout(25.0)(_compute_anomalies),
            dataset,
            filters,
        )
        set_cache(cache_key, result, DEFAULT_ANALYTICS_CACHE_TTL_SECONDS, tenant_id=dataset.get("tenant_id"))
        return result
    except Exception as exc:
        payload = _module_unavailable(f"Anomalies failed: {str(exc)}", ["revenue"], dataset)
        set_cache(cache_key, payload, 60, tenant_id=dataset.get("tenant_id"))
        return payload

def _compute_anomalies(dataset: dict[str, JsonValue], filters: dict[str, object]) -> dict[str, JsonValue]:
    """Internal anomalies computation without caching/circuit breaker."""
    revenue = _role(dataset, "revenue")
    customer = _role(dataset, "customer_id")
    product = _role(dataset, "product_id")
    if not revenue:
        return _module_unavailable("Missing revenue column", ["revenue"], dataset)
    where_sql, params = _apply_filters_sql(dataset, filters)
    table = _table(dataset)
    rows = DuckDBManager.instance().fetch_all(
        f"""
        select {to_identifier(revenue)} as revenue
               {", cast(" + to_identifier(customer) + " as varchar) as customer_id" if customer else ", null as customer_id"}
               {", cast(" + to_identifier(product) + " as varchar) as product_id" if product else ", null as product_id"}
        from {to_identifier(table)} {where_sql}
        where {to_identifier(revenue)} is not null
        limit {MAX_ANOMALY_ROWS}
        """,
        params,
    )
    if len(rows) < 10:
        payload = {
            "status": "ok",
            "data": {
                "summary": {"anomaly_count": 0, "total_rows": len(rows)},
                "rows": [],
            },
        }
        return payload
    frame = pd.DataFrame(rows)
    frame = _cap_frame(frame, MAX_ANOMALY_ROWS)
    model = IsolationForest(contamination=0.03, random_state=42)
    scores = model.fit_predict(frame[["revenue"]].astype(float))
    frame["anomaly"] = scores
    outliers = frame[frame["anomaly"] == -1].copy()
    outliers["anomaly_score"] = np.abs(outliers["revenue"].astype(float) - frame["revenue"].astype(float).mean())
    outliers = outliers.sort_values("anomaly_score", ascending=False).head(200)
    payload = {
        "status": "ok",
        "data": {
            "summary": {"anomaly_count": int(len(outliers)), "total_rows": int(len(frame))},
            "rows": outliers.where(pd.notnull(outliers), None).to_dict(orient="records"),
        },
    }
    return payload


def get_schema(dataset_id: str, version_id: str | None = None, *, tenant_id: str | None = None) -> dict[str, JsonValue] | None:
    dataset = _dataset_or_none(dataset_id, version_id=version_id, tenant_id=tenant_id)
    if not dataset:
        return None
    return {"status": "ok", "data": {"schema": dataset["schema"], "roles": dataset["roles"], "modules": dataset["modules"]}}


def get_profile(dataset_id: str, version_id: str | None = None, *, tenant_id: str | None = None) -> dict[str, JsonValue] | None:
    dataset = _dataset_or_none(dataset_id, version_id=version_id, tenant_id=tenant_id)
    return {"status": "ok", "data": dataset["profile"]}


def get_dashboard(
    dataset_id: str, 
    filters: dict[str, object], 
    version_id: str | None = None, 
    tenant_id: str | None = None
) -> dict[str, JsonValue] | None:
    dataset = _dataset_or_none(dataset_id, version_id=version_id, tenant_id=tenant_id)
    if not dataset:
        return None
    
    availability = dataset.get("modules") or {}
    include_ml = bool(filters.get("include_ml"))

    def module_payload(module_key: str, producer, *, requires_ml: bool = False):
        module_info = availability.get(module_key) or {}
        if not module_info.get("enabled", False):
            return None
        if requires_ml and not include_ml:
            return None
        return producer(filters, dataset)

    dashboard_data = {
        "overview": module_payload(
            "kpis",
            lambda filters, dataset: get_metrics(dataset_id, filters, version_id=version_id, tenant_id=tenant_id)
        ),
    }

    def normalize_module(
        module_id: str,
        title: str,
        payload: dict[str, JsonValue] | None,
        transform,
    ) -> dict[str, JsonValue]:
        if payload is None:
            return {"id": module_id, "title": title, "status": "error", "errorId": "dataset_not_found"}
        status = payload.get("status")
        if status != "ok":
            module = {"id": module_id, "title": title, "status": status}
            for key in ["reason", "required", "detected", "errorId", "error_id"]:
                if key in payload:
                    module[key if key != "error_id" else "errorId"] = payload[key]
            return module
        data = payload.get("data") or {}
        return {"id": module_id, "title": title, "status": "ok", "data": transform(data)}

    metrics_payload = module_payload("kpis", lambda filters, dataset: get_metrics(dataset_id, filters, version_id=version_id, tenant_id=tenant_id))
    modules = [
        normalize_module(
            "kpis",
            "KPIs",
            metrics_payload,
            lambda data: {
                "revenue": float(data.get("total_revenue") or 0),
                "orders": int(data.get("total_orders") or 0),
                "quantity": float(data.get("total_quantity") or 0),
            },
        ),
        normalize_module(
            "time-series",
            "Revenue Over Time",
            module_payload("time_series", lambda filters, dataset: get_time_series(dataset_id, filters, version_id=version_id, tenant_id=tenant_id)),
            lambda data: {
                "series": [
                    {"bucket": row.get("bucket"), "value": float(row.get("revenue") or 0)}
                    for row in data or []
                ]
            },
        ),
        normalize_module(
            "revenue-by-category",
            "Revenue By Category",
            module_payload(
                "revenue_by_category",
                lambda filters, dataset: get_revenue_by_category(dataset_id, filters, filters.get("top", 20), version_id=version_id, tenant_id=tenant_id),
            ),
            lambda data: {
                "categories": [
                    {"name": row.get("category"), "revenue": float(row.get("revenue") or 0)}
                    for row in data or []
                ]
            },
        ),
        normalize_module(
            "purchase-frequency",
            "Purchase Frequency",
            module_payload("purchase_frequency", lambda filters, dataset: get_purchase_frequency(dataset_id, filters, version_id=version_id, tenant_id=tenant_id)),
            lambda data: {
                "repeatVsNew": {
                    "repeatCustomers": int((data.get("repeat_vs_new") or {}).get("repeat_customers") or 0),
                    "newCustomers": int((data.get("repeat_vs_new") or {}).get("new_customers") or 0),
                },
                "ordersPerUserDistribution": [
                    {"orders": int(row.get("orders") or 0), "customers": int(row.get("customers") or 0)}
                    for row in data.get("orders_per_user_distribution") or []
                ],
                "trend": [
                    {"bucket": row.get("bucket"), "orders": int(row.get("orders") or 0)}
                    for row in data.get("trend") or []
                ],
            },
        ),
        normalize_module(
            "payment-analysis",
            "Payment Analysis",
            module_payload("payment_analysis", lambda filters, dataset: get_payment_analysis(dataset_id, filters, version_id=version_id, tenant_id=tenant_id)),
            lambda data: {
                "paymentMethods": [
                    {
                        "method": row.get("payment_method"),
                        "revenue": float(row.get("revenue") or 0),
                        "orders": int(row.get("orders") or 0),
                    }
                    for row in data or []
                ]
            },
        ),
        normalize_module(
            "returns",
            "Returns",
            module_payload("returns", lambda filters, dataset: get_returns(dataset_id, filters, version_id=version_id, tenant_id=tenant_id)),
            lambda data: {
                "byStatus": [
                    {"status": row.get("return_status"), "count": int(row.get("count") or 0)}
                    for row in (data.get("by_status") or [])
                ]
            },
        ),
        normalize_module(
            "customer-segmentation",
            "Customer Segmentation",
            module_payload("customer_segmentation", lambda filters, dataset: get_customer_segmentation(dataset_id, filters, version_id=version_id, tenant_id=tenant_id)),
            lambda data: {
                "total_customers": int(data.get("total_customers") or 0),
                "segment_counts": data.get("segment_counts") or {"high": 0, "medium": 0, "low": 0},
                "rfm_table": data.get("rfm_table") or [],
                "rfm_scatter": data.get("rfm_scatter") or [],
            },
        ),
        normalize_module(
            "anomalies",
            "Anomalies",
            module_payload("anomalies", lambda filters, dataset: get_anomalies(dataset_id, filters, version_id=version_id, tenant_id=tenant_id), requires_ml=True),
            lambda data: {
                "summary": {
                    "totalRows": int((data.get("summary") or {}).get("total_rows") or 0),
                    "anomalyCount": int((data.get("summary") or {}).get("anomaly_count") or 0),
                    "anomalyRate": (
                        (data.get("summary") or {}).get("anomaly_count") or 0
                    )
                    / max(1, int((data.get("summary") or {}).get("total_rows") or 0)),
                },
                "anomalies": [
                    {
                        "revenue": float(row.get("revenue") or 0),
                        "zScore": float(row.get("anomaly_score") or 0),
                    }
                    for row in data.get("rows") or []
                ],
            },
        ),
        normalize_module(
            "clv",
            "Customer Lifetime Value",
            module_payload("clv", lambda filters, dataset: get_clv(dataset_id, filters, version_id=version_id, tenant_id=tenant_id), requires_ml=True),
            lambda data: {
                "customers": [
                    {
                        "customerId": row.get("customer_id"),
                        "predictedClv": float(row.get("predicted_clv") or 0),
                        "monetary": 0,
                        "frequency": 0,
                    }
                    for row in data.get("predictions") or []
                ],
                "featureImportance": [
                    {"feature": row.get("feature"), "importance": float(row.get("importance") or 0)}
                    for row in data.get("feature_importance") or []
                ],
            },
        ),
        normalize_module(
            "recommendations",
            "Recommendations",
            module_payload("recommendations", lambda filters, dataset: get_recommendations(dataset_id, filters, version_id=version_id, tenant_id=tenant_id), requires_ml=True),
            lambda data: {
                "strategy": data.get("strategy"),
                "popular": [
                    {"productId": row.get("product_id"), "score": float(row.get("score") or 0)}
                    for row in data.get("popular") or []
                ],
                "recommendations": [
                    {
                        "customerId": row.get("customer_id"),
                        "items": [
                            {"productId": item.get("product_id"), "score": float(item.get("score") or 0)}
                            for item in row.get("items") or []
                        ],
                    }
                    for row in data.get("recommendations") or []
                ],
            },
        ),
    ]
    return {
        "status": "ok",
        "data": {
            "datasetId": dataset_id,
            "schema": dataset["schema"],
            "profile": dataset.get("profile") or {},
            "roles": dataset["roles"],
            "timestampNormalization": "UTC",
            "timestampSourceTimezone": None,
            "filterOptions": {
                "category": _unique_values(dataset, "category"),
                "paymentMethod": _unique_values(dataset, "payment_method"),
            },
            "modules": modules,
        },
    }
