function buildRFMQuery(datasetId, roles, filters) {
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
        ${roles.customer_id} as customer_id,
        MAX(${roles.timestamp}) as last_purchase,
        COUNT(*) as frequency,
        SUM(${roles.revenue}) as total_revenue,
        AVG(${roles.revenue}) as avg_revenue
    FROM clean_${datasetId}
    ${whereClause}
    GROUP BY ${roles.customer_id}
    ORDER BY total_revenue DESC
  `;
}

module.exports = { buildRFMQuery };
