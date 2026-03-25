from __future__ import annotations

from typing import Dict, List, Any, Optional
import duckdb
from app.db.duckdb_manager import DuckDBManager
from app.services.storage_service import get_dataset


def build_rfm_query(dataset_id: str, roles: Dict[str, str], filters: Optional[Dict[str, Any]] = None, table_name: str = None) -> str:
    """Build advanced RFM query with NTILE scoring and segmentation"""
    # Use actual table name if provided, otherwise construct it
    table = table_name or f"clean_{dataset_id}"
    
    # Build WHERE clause for filters
    where_conditions = []
    if filters:
        if filters.get("from_date") and filters.get("to_date") and roles.get("timestamp"):
            where_conditions.append(f"{roles['timestamp']} BETWEEN '{filters['from_date']}' AND '{filters['to_date']}'")
        if filters.get("category") and roles.get("category"):
            where_conditions.append(f"{roles['category']} = '{filters['category']}'")
        if filters.get("payment_method") and roles.get("payment_method"):
            where_conditions.append(f"{roles['payment_method']} = '{filters['payment_method']}'")
    
    where_clause = "WHERE " + " AND ".join(where_conditions) if where_conditions else ""
    
    return f"""
    WITH rfm_base AS (
        SELECT
            {roles['customer_id']} AS customer_id,
            COUNT(*) AS frequency,
            SUM({roles['revenue']}) AS monetary,
            MAX({roles['timestamp']}) AS last_purchase
        FROM {table}
        {where_clause}
        GROUP BY {roles['customer_id']}
    ),
    
    rfm_calc AS (
        SELECT *,
            DATE_DIFF('day', last_purchase, CURRENT_DATE) AS recency
        FROM rfm_base
    ),
    
    rfm_scores AS (
        SELECT *,
            NTILE(5) OVER (ORDER BY recency DESC) AS R,
            NTILE(5) OVER (ORDER BY frequency ASC) AS F,
            NTILE(5) OVER (ORDER BY monetary ASC) AS M
        FROM rfm_calc
    ),
    
    rfm_segments AS (
        SELECT *,
            CASE
                WHEN R >= 4 AND F >= 4 AND M >= 4 THEN 'Champions'
                WHEN F >= 4 AND M >= 4 THEN 'Loyal Customers'
                WHEN R >= 3 AND F >= 3 THEN 'Potential Loyalists'
                WHEN R <= 2 AND F >= 3 THEN 'At Risk'
                WHEN R <= 2 AND F <= 2 THEN 'Lost'
                ELSE 'Others'
            END AS segment
        FROM rfm_scores
    ),
    
    rfm_final AS (
        SELECT *,
            CASE
                WHEN NTILE(5) OVER (ORDER BY monetary DESC) = 1 THEN TRUE
                ELSE FALSE
            END AS is_top_20
        FROM rfm_segments
    )
    
    SELECT * FROM rfm_final
    ORDER BY monetary DESC
    """


def get_enhanced_rfm_data(dataset_id: str, filters: Optional[Dict[str, Any]] = None, tenant_id: Optional[str] = None) -> Dict[str, Any]:
    """Get enhanced RFM segmentation data with advanced business insights"""
    from app.services.analytics_service import _dataset_or_none, _role, _table
    
    try:
        # For development, if no tenant_id, try with "default" tenant
        effective_tenant_id = tenant_id or "default"
        
        # Use the same pattern as analytics service
        dataset = _dataset_or_none(dataset_id, tenant_id=effective_tenant_id)
        if not dataset:
            # Try without tenant_id restriction
            dataset = _dataset_or_none(dataset_id, tenant_id=None)
            if not dataset:
                raise ValueError(f"Dataset {dataset_id} not found")
        
        # Get roles using the analytics service pattern
        customer_id_col = _role(dataset, 'customer_id')
        revenue_col = _role(dataset, 'revenue')
        timestamp_col = _role(dataset, 'timestamp')
        
        if not all([customer_id_col, revenue_col, timestamp_col]):
            raise ValueError(f"Missing required roles: customer_id, revenue, timestamp")
        
        # Get table name
        table = _table(dataset)
        
        # For debugging
        print(f"Processing RFM for dataset: {dataset_id}")
        print(f"Table: {table}")
        print(f"Columns - customer_id: {customer_id_col}, revenue: {revenue_col}, timestamp: {timestamp_col}")
        
        # Build roles dict for query builder
        roles = {
            'customer_id': customer_id_col,
            'revenue': revenue_col,
            'timestamp': timestamp_col
        }
        
        # Build and execute RFM query
        query = build_rfm_query(dataset_id, roles, filters, table)
        
        db = DuckDBManager.instance()
        result = db.fetch_all(query)
        
        if not result:
            return {
                "total_customers": 0,
                "segment_counts": {
                    "champions": 0,
                    "loyal": 0,
                    "potential": 0,
                    "at_risk": 0,
                    "lost": 0
                },
                "top_20_percent_revenue": 0.0,
                "rfm_table": [],
                "rfm_scatter": []
            }
        
        print(f"RFM query returned {len(result)} rows")
        
        # Calculate segment counts
        segment_counts = {
            "champions": sum(1 for row in result if row['segment'] == 'Champions'),
            "loyal": sum(1 for row in result if row['segment'] == 'Loyal Customers'),
            "potential": sum(1 for row in result if row['segment'] == 'Potential Loyalists'),
            "at_risk": sum(1 for row in result if row['segment'] == 'At Risk'),
            "lost": sum(1 for row in result if row['segment'] == 'Lost')
        }
        
        # Calculate top 20% revenue contribution
        total_revenue = sum(row['monetary'] for row in result)
        top_20_revenue = sum(row['monetary'] for row in result if row['is_top_20'])
        top_20_percent_revenue = top_20_revenue / total_revenue if total_revenue > 0 else 0.0
        
        # Prepare RFM table data
        rfm_table = []
        for row in result[:100]:  # Limit to top 100 for performance
            rfm_table.append({
                "customer_id": row['customer_id'],
                "recency": row['recency'],
                "frequency": row['frequency'],
                "monetary": float(row['monetary']),
                "R": row['R'],
                "F": row['F'],
                "M": row['M'],
                "segment": row['segment'],
                "is_top_20": row['is_top_20']
            })
        
        # Prepare scatter plot data
        rfm_scatter = []
        for row in result:
            rfm_scatter.append({
                "frequency": row['frequency'],
                "monetary": float(row['monetary']),
                "segment": row['segment']
            })
        
        return {
            "total_customers": len(result),
            "segment_counts": segment_counts,
            "top_20_percent_revenue": top_20_percent_revenue,
            "rfm_table": rfm_table,
            "rfm_scatter": rfm_scatter
        }
        
    except Exception as e:
        print(f"Error in enhanced RFM: {str(e)}")
        import traceback
        traceback.print_exc()
        raise Exception(f"Error calculating enhanced RFM: {str(e)}")
