function buildPaymentQuery(datasetId, roles, filters) {
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
        ${roles.payment} as payment_method,
        COUNT(*) as transactions,
        SUM(${roles.revenue}) as revenue,
        AVG(${roles.revenue}) as avg_revenue
    FROM clean_${datasetId}
    ${whereClause}
    GROUP BY ${roles.payment}
    ORDER BY revenue DESC
  `;
}

module.exports = { buildPaymentQuery };
