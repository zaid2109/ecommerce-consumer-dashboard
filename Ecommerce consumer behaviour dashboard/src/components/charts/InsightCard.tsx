import React from 'react';

interface InsightCardProps {
  top20PercentRevenue: number;
  totalRevenue?: number;
}

export const InsightCard: React.FC<InsightCardProps> = ({ 
  top20PercentRevenue, 
  totalRevenue = 0 
}) => {
  const insightText = `Top 20% customers contribute ${(top20PercentRevenue * 100).toFixed(1)}% of total revenue`;
  
  return (
    <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-6 rounded-xl text-white mb-6">
      <div className="flex items-center">
        <div className="flex-1">
          <h3 className="text-lg font-semibold mb-2">💡 Key Insight</h3>
          <p className="text-xl font-bold">{insightText}</p>
          {totalRevenue > 0 && (
            <p className="text-sm mt-2 opacity-90">
              Total Revenue: ${totalRevenue.toLocaleString()}
            </p>
          )}
        </div>
        <div className="text-4xl ml-4">
          📊
        </div>
      </div>
    </div>
  );
};
