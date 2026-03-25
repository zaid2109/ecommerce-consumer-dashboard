from fastapi import APIRouter
import duckdb
from typing import Dict, Any

router = APIRouter()

def safe_execute(conn, query):
    try:
        result = conn.execute(query).fetchall()
        if not result:
            return {"status": "unavailable", "reason": "No data"}
        return {"status": "ok", "data": result}
    except Exception:
        return {"status": "error", "errorId": "QUERY_FAIL"}

def get_roles(dataset_id: str) -> Dict[str, str]:
    """Get dataset roles - simplified version"""
    # This would normally come from your storage service
    # For now, return basic roles based on your Sales.csv structure
    return {
        "customer_id": "dim_customer_key",
        "order_id": "order_id", 
        "revenue": "total_weighted_landing_price",
        "timestamp": "date_",
        "category": "city_name",
        "payment": "payment_method" if "payment_method" in ["payment_method", "payment"] else None,
        "quantity": "procured_quantity",
        "return_flag": "return_status" if "return_status" in ["return_status", "status"] else None
    }

@router.get("/dataset/{dataset_id}/dashboard")
def get_dashboard(dataset_id: str, filters: Dict[str, Any] = None):
    conn = duckdb.connect(':memory:')
    
    roles = get_roles(dataset_id)
    response = {}

    # Purchase Frequency
    if roles.get("customer_id") and roles.get("timestamp"):
        query = build_purchase_query(dataset_id, roles, filters)
        response["purchase_frequency"] = safe_execute(conn, query)
    else:
        response["purchase_frequency"] = {
            "status": "unavailable",
            "reason": "Missing required columns"
        }

    # Category Revenue
    if roles.get("revenue") and roles.get("category"):
        query = build_category_query(dataset_id, roles, filters)
        response["category_revenue"] = safe_execute(conn, query)
    else:
        response["category_revenue"] = {
            "status": "unavailable", 
            "reason": "Missing required columns"
        }

    # Customer Segmentation
    if roles.get("customer_id"):
        query = build_rfm_query(dataset_id, roles, filters)
        response["customer_segmentation"] = safe_execute(conn, query)
    else:
        response["customer_segmentation"] = {
            "status": "unavailable",
            "reason": "Missing required columns"
        }

    # Payment Analysis
    if roles.get("payment"):
        query = build_payment_query(dataset_id, roles, filters)
        response["payment_analysis"] = safe_execute(conn, query)
    else:
        response["payment_analysis"] = {
            "status": "unavailable",
            "reason": "Missing payment column"
        }

    # Returns
    if roles.get("return_flag"):
        query = build_returns_query(dataset_id, roles, filters)
        response["returns"] = safe_execute(conn, query)
    else:
        response["returns"] = {
            "status": "unavailable",
            "reason": "Missing return indicator"
        }

    return response

# Query builders (simplified versions)
def build_purchase_query(dataset_id: str, roles: Dict[str, str], filters: Dict[str, Any]) -> str:
    """Build purchase frequency query"""
    return f"""
        SELECT 
            COUNT(*) as total_orders,
            COUNT(DISTINCT {roles['customer_id']}) as unique_customers,
            AVG({roles['quantity']}) as avg_quantity,
            EXTRACT(MONTH FROM {roles['timestamp']}) as month
        FROM clean_{dataset_id}
        WHERE {roles['timestamp']} IS NOT NULL
        GROUP BY EXTRACT(MONTH FROM {roles['timestamp']})
        ORDER BY month
    """

def build_category_query(dataset_id: str, roles: Dict[str, str], filters: Dict[str, Any]) -> str:
    """Build category revenue query"""
    return f"""
        SELECT 
            {roles['category']} as category,
            SUM({roles['revenue']}) as revenue,
            COUNT(*) as orders,
            AVG({roles['revenue']}) as avg_revenue
        FROM clean_{dataset_id}
        WHERE {roles['category']} IS NOT NULL
        GROUP BY {roles['category']}
        ORDER BY revenue DESC
    """

def build_rfm_query(dataset_id: str, roles: Dict[str, str], filters: Dict[str, Any]) -> str:
    """Build RFM segmentation query"""
    return f"""
        SELECT 
            {roles['customer_id']} as customer_id,
            MAX({roles['timestamp']}) as last_purchase,
            COUNT(*) as frequency,
            SUM({roles['revenue']}) as total_revenue
        FROM clean_{dataset_id}
        WHERE {roles['timestamp']} IS NOT NULL
        GROUP BY {roles['customer_id']}
        ORDER BY total_revenue DESC
    """

def build_payment_query(dataset_id: str, roles: Dict[str, str], filters: Dict[str, Any]) -> str:
    """Build payment analysis query"""
    return f"""
        SELECT 
            {roles['payment']} as payment_method,
            COUNT(*) as transactions,
            SUM({roles['revenue']}) as revenue,
            AVG({roles['revenue']}) as avg_revenue
        FROM clean_{dataset_id}
        WHERE {roles['payment']} IS NOT NULL
        GROUP BY {roles['payment']}
        ORDER BY revenue DESC
    """

def build_returns_query(dataset_id: str, roles: Dict[str, str], filters: Dict[str, Any]) -> str:
    """Build returns analysis query"""
    return f"""
        SELECT 
            CASE 
                WHEN {roles.get('return_flag')} = TRUE THEN 'Returned'
                ELSE 'Not Returned'
            END as return_status,
            COUNT(*) as total_orders,
            SUM(CASE WHEN {roles.get('return_flag')} = TRUE THEN 1 ELSE 0 END) as returned_orders
        FROM clean_{dataset_id}
        GROUP BY 
            CASE 
                WHEN {roles.get('return_flag')} = TRUE THEN 'Returned'
                ELSE 'Not Returned'
            END
    """
