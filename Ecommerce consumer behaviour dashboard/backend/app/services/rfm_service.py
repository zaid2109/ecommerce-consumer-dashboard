"""
RFM (Recency, Frequency, Monetary) Customer Segmentation Service.
"""

from __future__ import annotations

from typing import Any, Dict, List

from app.db.duckdb_manager import DuckDBManager
from app.utils.helpers import to_identifier


def validate_rfm_requirements(dataset: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate that dataset has required columns for RFM analysis.
    
    Args:
        dataset: Dataset metadata with roles
        
    Returns:
        Validation result with status and reason if unavailable
    """
    roles = dataset.get("roles", {})
    
    required_roles = ["customer_id", "revenue", "timestamp"]
    missing_roles = []
    detected_roles = []
    
    for role in required_roles:
        role_info = roles.get(role)
        if role_info and role_info.get("column"):
            detected_roles.append(f"{role} ({role_info.get('column')})")
        else:
            missing_roles.append(role)
    
    if missing_roles:
        return {
            "status": "unavailable",
            "reason": f"Missing {', '.join(missing_roles)}. Detected: {', '.join(detected_roles) if detected_roles else 'none'}"
        }
    
    return {"status": "ok"}


def compute_rfm_segmentation(
    dataset_id: str,
    dataset: Dict[str, Any],
    filters: Dict[str, Any] | None = None,
    version_id: str | None = None,
    *,
    tenant_id: str | None = None
) -> Dict[str, Any]:
    """
    Compute RFM segmentation for customers.
    
    Args:
        dataset_id: Dataset identifier
        dataset: Dataset metadata
        filters: Optional filters to apply
        version_id: Dataset version
        tenant_id: Tenant identifier
        
    Returns:
        RFM segmentation results with customer segments and distribution
    """
    # Step 1: Validation
    validation = validate_rfm_requirements(dataset)
    if validation["status"] != "ok":
        return validation
    
    # Get column names from roles with fallbacks
    roles = dataset.get("roles", {})
    
    # Helper function to get role column with fallback
    def get_role_column(role_name: str, fallback_patterns: list[str]) -> str | None:
        role_info = roles.get(role_name)
        if role_info and role_info.get("column"):
            return role_info.get("column")
        
        # Fallback: look for columns matching patterns
        schema = dataset.get("schema", [])
        for column in schema:
            col_name = str(column.get("name", "")).lower()
            for pattern in fallback_patterns:
                if pattern.lower() in col_name:
                    return column.get("name")
        return None
    
    customer_col = get_role_column("customer_id", ["customer", "client", "buyer", "user"])
    revenue_col = get_role_column("revenue", ["revenue", "sales", "amount", "value", "price", "total"])
    timestamp_col = get_role_column("timestamp", ["date", "time", "timestamp", "created", "ordered", "order_date"])
    
    if not customer_col or not revenue_col or not timestamp_col:
        missing = []
        if not customer_col: missing.append("customer_id")
        if not revenue_col: missing.append("revenue") 
        if not timestamp_col: missing.append("timestamp")
        return {
            "status": "unavailable",
            "reason": f"Missing required columns: {', '.join(missing)}. Found: customer_id={customer_col}, revenue={revenue_col}, timestamp={timestamp_col}"
        }
    
    # Get clean table name
    tables = dataset.get("tables", {})
    clean_table = to_identifier(tables.get("clean", f"clean_{dataset_id}"))
    
    if not clean_table:
        return {
            "status": "error",
            "errorId": "RFM_001",
            "reason": "Clean table not found"
        }
    
    db = DuckDBManager.instance()
    
    try:
        # Step 2: Build filter conditions
        filter_conditions = []
        filter_params = {}
        
        if filters:
            # Date range filter
            if "date_range" in filters and timestamp_col:
                date_range = filters["date_range"]
                if date_range.get("start"):
                    filter_conditions.append(f"{to_identifier(timestamp_col)} >= %(start_date)s")
                    filter_params["start_date"] = date_range["start"]
                if date_range.get("end"):
                    filter_conditions.append(f"{to_identifier(timestamp_col)} <= %(end_date)s")
                    filter_params["end_date"] = date_range["end"]
            
            # Category filter
            if "category" in filters:
                category_col = get_role_column("category", ["category", "product_category", "dept"])
                if category_col:
                    filter_conditions.append(f"{to_identifier(category_col)} = %(category)s")
                    filter_params["category"] = filters["category"]
            
            # Payment method filter
            if "payment_method" in filters:
                payment_col = get_role_column("payment_method", ["payment", "method", "channel"])
                if payment_col:
                    filter_conditions.append(f"{to_identifier(payment_col)} = %(payment_method)s")
                    filter_params["payment_method"] = filters["payment_method"]
        
        where_clause = ""
        if filter_conditions:
            where_clause = "WHERE " + " AND ".join(filter_conditions)
        
        # Step 3: Base RFM query with recency calculation
        base_query = f"""
        WITH customer_rfm AS (
            SELECT 
                {to_identifier(customer_col)} AS customer_id,
                COUNT(*) AS frequency,
                SUM({to_identifier(revenue_col)}) AS monetary,
                MAX({to_identifier(timestamp_col)}) AS last_purchase
            FROM {clean_table}
            {where_clause}
            WHERE {to_identifier(revenue_col)} IS NOT NULL 
            AND {to_identifier(customer_col)} IS NOT NULL
            GROUP BY {to_identifier(customer_col)}
        ),
        customer_rfm_with_recency AS (
            SELECT 
                customer_id,
                frequency,
                monetary,
                last_purchase,
                DATEDIFF('day', last_purchase, CURRENT_DATE) AS recency
            FROM customer_rfm
        )
        SELECT * FROM customer_rfm_with_recency
        """
        
        rfm_data = db.fetch_all(base_query, filter_params)
        
        if not rfm_data:
            return {
                "status": "ok",
                "data": {
                    "total_customers": 0,
                    "segment_counts": {"high": 0, "medium": 0, "low": 0},
                    "rfm_table": [],
                    "rfm_scatter": []
                }
            }
        
        # Step 4: Calculate percentiles for segmentation
        # Sort by monetary value for percentile calculation
        sorted_by_monetary = sorted(rfm_data, key=lambda x: x["monetary"] or 0, reverse=True)
        total_customers = len(sorted_by_monetary)
        
        # Define percentile thresholds
        high_threshold = int(total_customers * 0.3)  # Top 30%
        medium_threshold = int(total_customers * 0.7)  # Top 70% (middle 40%)
        
        # Step 5: Apply segmentation logic
        segmented_data = []
        segment_counts = {"high": 0, "medium": 0, "low": 0}
        
        for i, customer in enumerate(sorted_by_monetary):
            # Determine segment based on percentile
            if i < high_threshold:
                segment = "High"
            elif i < medium_threshold:
                segment = "Medium"
            else:
                segment = "Low"
            
            # Add segment to customer data
            customer_with_segment = {
                **customer,
                "segment": segment
            }
            segmented_data.append(customer_with_segment)
            
            # Count segment
            segment_counts[segment] += 1
        
        # Step 6: Prepare response data
        rfm_table = []
        rfm_scatter = []
        
        for customer in segmented_data:
            # Table data with all RFM metrics
            rfm_table.append({
                "customer_id": customer["customer_id"],
                "recency": customer["recency"] or 0,
                "frequency": customer["frequency"] or 0,
                "monetary": float(customer["monetary"] or 0),
                "segment": customer["segment"]
            })
            
            # Scatter plot data (frequency vs monetary)
            rfm_scatter.append({
                "frequency": customer["frequency"] or 0,
                "monetary": float(customer["monetary"] or 0),
                "segment": customer["segment"]
            })
        
        return {
            "status": "ok",
            "data": {
                "total_customers": total_customers,
                "segment_counts": segment_counts,
                "rfm_table": rfm_table,
                "rfm_scatter": rfm_scatter
            }
        }
        
    except Exception as e:
        return {
            "status": "error",
            "errorId": "RFM_001",
            "reason": f"RFM computation failed: {str(e)}"
        }
