from __future__ import annotations

from typing import Dict, List, Any, Optional
from app.db.duckdb_manager import DuckDBManager


def _get_helpers():
    """Import helpers to avoid circular import"""
    from app.services.analytics_service import _dataset_or_none, _role, _table
    return _dataset_or_none, _role, _table


def build_payment_query(dataset_id: str, roles: Dict[str, str], filters: Optional[Dict[str, Any]] = None, table_name: str = None) -> str:
    """Build payment analysis query with dynamic filtering"""
    # Use actual table name if provided, otherwise construct it
    table = table_name or f"clean_{dataset_id}"
    
    # Build WHERE clause for filters
    where_conditions = []
    if filters:
        if filters.get("from_date") and filters.get("to_date") and roles.get("timestamp"):
            where_conditions.append(f"{roles['timestamp']} BETWEEN '{filters['from_date']}' AND '{filters['to_date']}'")
        if filters.get("category") and roles.get("category"):
            where_conditions.append(f"{roles['category']} = '{filters['category']}'")
        if filters.get("payment_method") and roles.get("payment"):
            where_conditions.append(f"{roles['payment']} = '{filters['payment_method']}'")
    
    where_clause = "WHERE " + " AND ".join(where_conditions) if where_conditions else ""
    
    return f"""
    SELECT
        {roles['payment']} AS method,
        COUNT(*) AS transactions,
        SUM({roles['revenue']}) AS revenue,
        AVG({roles['revenue']}) AS avg_order_value
    FROM {table}
    {where_clause}
    GROUP BY {roles['payment']}
    ORDER BY revenue DESC
    """


def build_total_transactions_query(dataset_id: str, roles: Dict[str, str], filters: Optional[Dict[str, Any]] = None, table_name: str = None) -> str:
    """Build query to get total transactions"""
    table = table_name or f"clean_{dataset_id}"
    
    # Build WHERE clause for filters
    where_conditions = []
    if filters:
        if filters.get("from_date") and filters.get("to_date") and roles.get("timestamp"):
            where_conditions.append(f"{roles['timestamp']} BETWEEN '{filters['from_date']}' AND '{filters['to_date']}'")
        if filters.get("category") and roles.get("category"):
            where_conditions.append(f"{roles['category']} = '{filters['category']}'")
        if filters.get("payment_method") and roles.get("payment"):
            where_conditions.append(f"{roles['payment']} = '{filters['payment_method']}'")
    
    where_clause = "WHERE " + " AND ".join(where_conditions) if where_conditions else ""
    
    return f"""
    SELECT COUNT(*) AS total_transactions
    FROM {table}
    {where_clause}
    """


def build_online_vs_cod_query(dataset_id: str, roles: Dict[str, str], filters: Optional[Dict[str, Any]] = None, table_name: str = None) -> str:
    """Build query to analyze online vs COD payment split"""
    table = table_name or f"clean_{dataset_id}"
    
    # Build WHERE clause for filters
    where_conditions = []
    if filters:
        if filters.get("from_date") and filters.get("to_date") and roles.get("timestamp"):
            where_conditions.append(f"{roles['timestamp']} BETWEEN '{filters['from_date']}' AND '{filters['to_date']}'")
        if filters.get("category") and roles.get("category"):
            where_conditions.append(f"{roles['category']} = '{filters['category']}'")
    
    where_clause = "WHERE " + " AND ".join(where_conditions) if where_conditions else ""
    
    return f"""
    SELECT
        CASE
            WHEN LOWER({roles['payment']}) = 'cod' THEN 'COD'
            ELSE 'Online'
        END AS payment_type,
        COUNT(*) AS count
    FROM {table}
    {where_clause}
    GROUP BY payment_type
    """


async def get_payment_analysis_data(dataset_id: str, filters: Optional[Dict[str, Any]] = None, tenant_id: str = None) -> Dict[str, Any]:
    """
    Get payment analysis data for a dataset.
    
    Args:
        dataset_id: The dataset identifier
        filters: Optional filters to apply
        tenant_id: Optional tenant identifier
        
    Returns:
        Dictionary containing payment analysis data
    """
    try:
        # Get helper functions to avoid circular import
        _dataset_or_none, _role, _table = _get_helpers()
        
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
        
        # Check if required roles are available
        payment_col = _role(dataset, 'payment')
        revenue_col = _role(dataset, 'revenue')
        
        print(f"Payment column: {payment_col}, Revenue column: {revenue_col}")
        
        if not payment_col or not revenue_col:
            print("Missing payment or revenue column")
            return {
                "status": "unavailable",
                "reason": "Missing payment or revenue column"
            }
        
        # Get table name
        table = _table(dataset)
        print(f"Table name: {table}")
        
        # Build roles dict for query builder
        roles = {
            'payment': payment_col,
            'revenue': revenue_col
        }
        
        # Execute queries
        db = DuckDBManager.instance()
        
        # Main payment distribution query
        payment_query = build_payment_query(dataset_id, roles, filters, table)
        print(f"Payment query: {payment_query}")
        
        payment_data = db.fetch_all(payment_query)
        print(f"Payment data rows: {len(payment_data) if payment_data else 0}")
        
        # Total transactions query
        total_query = build_total_transactions_query(dataset_id, roles, filters, table)
        print(f"Total query: {total_query}")
        
        total_result = db.fetch_all(total_query)
        total_transactions = total_result[0]['total_transactions'] if total_result else 0
        print(f"Total transactions: {total_transactions}")
        
        if not payment_data:
            print("No payment data returned")
            return {
                "status": "ok",
                "data": {
                    "total_transactions": 0,
                    "most_used_method": None,
                    "payment_table": [],
                    "payment_distribution": [],
                    "revenue_by_payment": []
                }
            }
        
        # Find most used payment method
        most_used_method = max(payment_data, key=lambda x: x['transactions'])['method']
        print(f"Most used method: {most_used_method}")
        
        # Calculate overall average order value
        total_revenue = sum(row['revenue'] for row in payment_data)
        overall_avg_order_value = total_revenue / total_transactions if total_transactions > 0 else 0
        print(f"Total revenue: {total_revenue}, Avg order value: {overall_avg_order_value}")
        
        # Prepare payment table data
        payment_table = []
        payment_distribution = []
        revenue_by_payment = []
        
        for row in payment_data:
            payment_table.append({
                "method": row['method'],
                "transactions": row['transactions'],
                "revenue": float(row['revenue']),
                "avg_order_value": float(row['avg_order_value'])
            })
            
            payment_distribution.append({
                "method": row['method'],
                "value": row['transactions']
            })
            
            revenue_by_payment.append({
                "method": row['method'],
                "value": float(row['revenue'])
            })
        
        # Try to get online vs COD split if COD exists
        online_vs_cod_data = None
        try:
            cod_query = build_online_vs_cod_query(dataset_id, roles, filters, table)
            cod_result = db.fetch_all(cod_query)
            if cod_result:
                online_vs_cod_data = [
                    {"payment_type": row['payment_type'], "count": row['count']}
                    for row in cod_result
                ]
        except Exception as e:
            print(f"Optional COD query failed: {e}")
            pass  # Optional query, continue if it fails
        
        result = {
            "status": "ok",
            "data": {
                "total_transactions": total_transactions,
                "most_used_method": most_used_method,
                "overall_avg_order_value": float(overall_avg_order_value),
                "total_revenue": float(total_revenue),
                "payment_table": payment_table,
                "payment_distribution": payment_distribution,
                "revenue_by_payment": revenue_by_payment,
                "online_vs_cod": online_vs_cod_data
            }
        }
        
        print(f"Payment analysis completed successfully")
        return result
        
    except Exception as e:
        print(f"Error in payment analysis: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            "status": "error",
            "errorId": "PAY_001",
            "error": str(e)
        }
