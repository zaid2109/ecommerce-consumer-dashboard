function buildPurchaseQuery(datasetId, roles, filters) {
  const conditions = [];
  
  if (filters.from_date) {
    conditions.push(`date_ >= '${filters.from_date}'`);
  }
  
  if (filters.to_date) {
    conditions.push(`date_ <= '${filters.to_date}'`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  return `
    SELECT 
        COUNT(*) as total_orders,
        COUNT(DISTINCT ${roles.customer_id}) as unique_customers,
        AVG(${roles.quantity}) as avg_quantity,
        EXTRACT(MONTH FROM ${roles.timestamp}) as month
    FROM clean_${datasetId}
    ${whereClause}
    GROUP BY EXTRACT(MONTH FROM ${roles.timestamp})
    ORDER BY month
  `;
}

module.exports = { buildPurchaseQuery };
