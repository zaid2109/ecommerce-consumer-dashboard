function buildReturnsQuery(datasetId, roles, filters) {
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
        CASE 
            WHEN ${roles.return_flag} = TRUE THEN 'Returned'
            ELSE 'Not Returned'
        END as return_status,
        COUNT(*) as total_orders,
        SUM(CASE WHEN ${roles.return_flag} = TRUE THEN 1 ELSE 0 END) as returned_orders,
        AVG(CASE WHEN ${roles.return_flag} = TRUE THEN ${roles.revenue} ELSE 0 END) as avg_refund_amount
    FROM clean_${datasetId}
    ${whereClause}
    GROUP BY 
        CASE 
            WHEN ${roles.return_flag} = TRUE THEN 'Returned'
            ELSE 'Not Returned'
        END
    ORDER BY return_status
  `;
}

module.exports = { buildReturnsQuery };
