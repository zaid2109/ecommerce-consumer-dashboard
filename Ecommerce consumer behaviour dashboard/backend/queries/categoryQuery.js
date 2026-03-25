function buildCategoryQuery(datasetId, roles, filters) {
  const conditions = [];
  
  if (filters.from_date) {
    conditions.push(`date_ >= '${filters.from_date}'`);
  }
  
  if (filters.to_date) {
    conditions.push(`date_ <= '${filters.to_date}'`);
  }

  if (filters.category) {
    conditions.push(`${roles.category} = '${filters.category}'`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  return `
    SELECT 
        ${roles.category} as category,
        SUM(${roles.revenue}) as revenue,
        COUNT(*) as orders,
        AVG(${roles.revenue}) as avg_revenue
    FROM clean_${datasetId}
    ${whereClause}
    GROUP BY ${roles.category}
    ORDER BY revenue DESC
  `;
}

module.exports = { buildCategoryQuery };
