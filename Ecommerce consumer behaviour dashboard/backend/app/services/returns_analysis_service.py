from __future__ import annotations

from typing import Dict, List, Any, Optional
from app.db.duckdb_manager import DuckDBManager
from app.services.analytics_service import _dataset_or_none, _role, _table


def build_return_condition(roles: Dict[str, str]) -> str:
    """Build return condition based on available columns"""
    if roles.get('return_flag'):
        return f"{roles['return_flag']} = TRUE"
    elif roles.get('status'):
        return f"LOWER({roles['status']}) IN ('returned', 'refunded')"
    else:
        raise ValueError("No return indicator column available")


def build_returns_query(dataset_id: str, roles: Dict[str, str], filters: Optional[Dict[str, Any]] = None, table_name: str = None) -> str:
    """Build returns analysis query with dynamic filtering"""
    table = table_name or f"clean_{dataset_id}"
    
    # Build WHERE clause for filters
    where_conditions = []
    if filters:
        if filters.get("from_date") and filters.get("to_date") and roles.get('timestamp'):
            where_conditions.append(f"{roles['timestamp']} BETWEEN '{filters['from_date']}' AND '{filters['to_date']}'")
        if filters.get("category") and roles.get('category'):
            where_conditions.append(f"{roles['category']} = '{filters['category']}'")
        if filters.get("payment_method") and roles.get('payment'):
            where_conditions.append(f"{roles['payment']} = '{filters['payment_method']}'")
    
    where_clause = "WHERE " + " AND ".join(where_conditions) if where_conditions else ""
    
    # Build return condition
    return_condition = build_return_condition(roles)
    
    return f"""
    SELECT
        COUNT(*) AS total_orders,
        COUNT(*) FILTER (WHERE {return_condition}) AS total_returns,
        COUNT(*) FILTER (WHERE NOT ({return_condition})) AS non_returns
    FROM {table}
    {where_clause}
    """


def build_return_rate_query(dataset_id: str, roles: Dict[str, str], filters: Optional[Dict[str, Any]] = None, table_name: str = None) -> str:
    """Build return rate query"""
    table = table_name or f"clean_{dataset_id}"
    
    # Build WHERE clause for filters
    where_conditions = []
    if filters:
        if filters.get("from_date") and filters.get("to_date") and roles.get('timestamp'):
            where_conditions.append(f"{roles['timestamp']} BETWEEN '{filters['from_date']}' AND '{filters['to_date']}'")
        if filters.get("category") and roles.get('category'):
            where_conditions.append(f"{roles['category']} = '{filters['category']}'")
        if filters.get("payment_method") and roles.get('payment'):
            where_conditions.append(f"{roles['payment']} = '{filters['payment_method']}'")
    
    where_clause = "WHERE " + " AND ".join(where_conditions) if where_conditions else ""
    
    # Build return condition
    return_condition = build_return_condition(roles)
    
    return f"""
    SELECT
        COUNT(*) FILTER (WHERE {return_condition}) * 1.0 / NULLIF(COUNT(*), 0) AS return_rate
    FROM {table}
    {where_clause}
    """


def build_returns_by_category_query(dataset_id: str, roles: Dict[str, str], filters: Optional[Dict[str, Any]] = None, table_name: str = None) -> str:
    """Build returns by category query"""
    table = table_name or f"clean_{dataset_id}"
    
    if not roles.get('category'):
        raise ValueError("Category column not available")
    
    # Build WHERE clause for filters
    where_conditions = []
    if filters:
        if filters.get("from_date") and filters.get("to_date") and roles.get('timestamp'):
            where_conditions.append(f"{roles['timestamp']} BETWEEN '{filters['from_date']}' AND '{filters['to_date']}'")
        if filters.get("payment_method") and roles.get('payment'):
            where_conditions.append(f"{roles['payment']} = '{filters['payment_method']}'")
    
    where_clause = "WHERE " + " AND ".join(where_conditions) if where_conditions else ""
    
    # Build return condition
    return_condition = build_return_condition(roles)
    
    return f"""
    SELECT
        {roles['category']} AS category,
        COUNT(*) FILTER (WHERE {return_condition}) AS returns,
        COUNT(*) AS total_orders
    FROM {table}
    {where_clause}
    GROUP BY {roles['category']}
    ORDER BY returns DESC
    """


def build_returns_over_time_query(dataset_id: str, roles: Dict[str, str], filters: Optional[Dict[str, Any]] = None, table_name: str = None) -> str:
    """Build returns over time query"""
    table = table_name or f"clean_{dataset_id}"
    
    if not roles.get('timestamp'):
        raise ValueError("Timestamp column not available")
    
    # Build WHERE clause for filters
    where_conditions = []
    if filters:
        if filters.get("category") and roles.get('category'):
            where_conditions.append(f"{roles['category']} = '{filters['category']}'")
        if filters.get("payment_method") and roles.get('payment'):
            where_conditions.append(f"{roles['payment']} = '{filters['payment_method']}'")
    
    where_clause = "WHERE " + " AND ".join(where_conditions) if where_conditions else ""
    
    # Add date filter if provided
    if filters and filters.get("from_date") and filters.get("to_date"):
        where_conditions.append(f"{roles['timestamp']} BETWEEN '{filters['from_date']}' AND '{filters['to_date']}'")
    
    where_clause = "WHERE " + " AND ".join(where_conditions) if where_conditions else ""
    
    # Build return condition
    return_condition = build_return_condition(roles)
    
    return f"""
    SELECT
        DATE_TRUNC('month', {roles['timestamp']}) AS month,
        COUNT(*) FILTER (WHERE {return_condition}) AS returns,
        COUNT(*) AS total_orders
    FROM {table}
    {where_clause}
    GROUP BY DATE_TRUNC('month', {roles['timestamp']})
    ORDER BY month
    """


def build_refund_amount_query(dataset_id: str, roles: Dict[str, str], filters: Optional[Dict[str, Any]] = None, table_name: str = None) -> str:
    """Build refund amount query"""
    table = table_name or f"clean_{dataset_id}"
    
    # Build WHERE clause for filters
    where_conditions = []
    if filters:
        if filters.get("from_date") and filters.get("to_date") and roles.get('timestamp'):
            where_conditions.append(f"{roles['timestamp']} BETWEEN '{filters['from_date']}' AND '{filters['to_date']}'")
        if filters.get("category") and roles.get('category'):
            where_conditions.append(f"{roles['category']} = '{filters['category']}'")
        if filters.get("payment_method") and roles.get('payment'):
            where_conditions.append(f"{roles['payment']} = '{filters['payment_method']}'")
    
    where_clause = "WHERE " + " AND ".join(where_conditions) if where_conditions else ""
    
    # Build return condition
    return_condition = build_return_condition(roles)
    
    # Build refund condition
    if roles.get('refund_amount'):
        refund_expr = f"SUM(CASE WHEN {return_condition} THEN {roles['refund_amount']} ELSE 0 END)"
    else:
        refund_expr = "0"
    
    return f"""
    SELECT {refund_expr} AS total_refund
    FROM {table}
    {where_clause}
    """


def get_returns_analysis_data(dataset_id: str, filters: Optional[Dict[str, Any]] = None, tenant_id: Optional[str] = None) -> Dict[str, Any]:
    """Get comprehensive returns analysis data"""
    try:
        print(f"Processing returns analysis for dataset: {dataset_id}")
        
        # For development, if no tenant_id, try with "default" tenant
        effective_tenant_id = tenant_id or "default"
        
        # Use the same pattern as analytics service
        dataset = _dataset_or_none(dataset_id, tenant_id=effective_tenant_id)
        if not dataset:
            # Try without tenant_id restriction
            dataset = _dataset_or_none(dataset_id, tenant_id=None)
            if not dataset:
                print(f"Dataset {dataset_id} not found")
                return {
                    "status": "unavailable",
                    "reason": f"Dataset {dataset_id} not found"
                }
        
        print(f"Dataset found: {dataset}")
        
        # Check if return indicator is available
        return_flag = _role(dataset, 'return_flag')
        status_col = _role(dataset, 'status')
        
        if not return_flag and not status_col:
            print("Missing return indicator column")
            return {
                "status": "unavailable",
                "reason": "Missing return indicator column"
            }
        
        # Get table name
        table = _table(dataset)
        print(f"Table name: {table}")
        
        # Build roles dict
        roles = {}
        if return_flag:
            roles['return_flag'] = return_flag
        if status_col:
            roles['status'] = status_col
        
        # Add other roles if available
        for role_name in ['category', 'revenue', 'timestamp', 'payment', 'refund_amount']:
            role_col = _role(dataset, role_name)
            if role_col:
                roles[role_name] = role_col
        
        print(f"Available roles: {list(roles.keys())}")
        
        # Execute queries
        db = DuckDBManager.instance()
        
        # Main returns query
        returns_query = build_returns_query(dataset_id, roles, filters, table)
        print(f"Returns query: {returns_query}")
        
        returns_result = db.fetch_all(returns_query)
        print(f"Returns result: {returns_result}")
        
        # Return rate query
        rate_query = build_return_rate_query(dataset_id, roles, filters, table)
        rate_result = db.fetch_all(rate_query)
        return_rate = rate_result[0]['return_rate'] if rate_result else 0.0
        
        # Refund amount query
        total_refund = 0
        try:
            refund_query = build_refund_amount_query(dataset_id, roles, filters, table)
            refund_result = db.fetch_all(refund_query)
            total_refund = refund_result[0]['total_refund'] if refund_result else 0
        except Exception as e:
            print(f"Refund query failed: {e}")
            total_refund = 0
        
        if not returns_result:
            print("No returns data returned")
            return {
                "status": "ok",
                "data": {
                    "return_rate": 0.0,
                    "total_returns": 0,
                    "total_refund": 0.0,
                    "returns_by_category": [],
                    "returns_over_time": [],
                    "return_distribution": [
                        {"type": "Returned", "value": 0},
                        {"type": "Not Returned", "value": 0}
                    ]
                }
            }
        
        total_returns = returns_result[0]['total_returns']
        total_orders = returns_result[0]['total_orders']
        non_returns = returns_result[0]['non_returns']
        
        print(f"Total orders: {total_orders}, Total returns: {total_returns}")
        
        # Returns by category (if category available)
        returns_by_category = []
        if 'category' in roles:
            try:
                category_query = build_returns_by_category_query(dataset_id, roles, filters, table)
                category_result = db.fetch_all(category_query)
                
                returns_by_category = [
                    {
                        "category": row['category'],
                        "returns": row['returns'],
                        "total_orders": row['total_orders']
                    }
                    for row in category_result
                ]
            except Exception as e:
                print(f"Category query failed: {e}")
        
        # Returns over time (if timestamp available)
        returns_over_time = []
        if 'timestamp' in roles:
            try:
                time_query = build_returns_over_time_query(dataset_id, roles, filters, table)
                time_result = db.fetch_all(time_query)
                
                returns_over_time = [
                    {
                        "month": row['month'].strftime('%Y-%m') if hasattr(row['month'], 'strftime') else str(row['month']),
                        "returns": row['returns'],
                        "total_orders": row['total_orders']
                    }
                    for row in time_result
                ]
            except Exception as e:
                print(f"Time query failed: {e}")
        
        # Return distribution
        return_distribution = [
            {"type": "Returned", "value": total_returns},
            {"type": "Not Returned", "value": non_returns}
        ]
        
        # Find most returned category
        most_returned_category = None
        if returns_by_category:
            most_returned_category = max(returns_by_category, key=lambda x: x['returns'])['category']
        
        result = {
            "status": "ok",
            "data": {
                "return_rate": float(return_rate),
                "total_returns": total_returns,
                "total_refund": float(total_refund),
                "most_returned_category": most_returned_category,
                "returns_by_category": returns_by_category,
                "returns_over_time": returns_over_time,
                "return_distribution": return_distribution
            }
        }
        
        print(f"Returns analysis completed successfully")
        return result
        
    except Exception as e:
        print(f"Error in returns analysis: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            "status": "error",
            "errorId": "RET_001",
            "error": str(e)
        }
