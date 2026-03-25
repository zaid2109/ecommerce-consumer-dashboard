import React from 'react';

interface KPICardsProps {
  totalCustomers: number;
  champions: number;
  atRisk: number;
  top20PercentRevenue: number;
}

export const KPICards: React.FC<KPICardsProps> = ({ 
  totalCustomers, 
  champions, 
  atRisk, 
  top20PercentRevenue 
}) => {
  const kpiData = [
    {
      title: "Total Customers",
      value: totalCustomers.toLocaleString(),
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      icon: "👥"
    },
    {
      title: "Champions",
      value: champions.toLocaleString(),
      color: "text-green-600",
      bgColor: "bg-green-50",
      icon: "🏆"
    },
    {
      title: "At Risk Customers",
      value: atRisk.toLocaleString(),
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      icon: "⚠️"
    },
    {
      title: "Top 20% Revenue",
      value: `${(top20PercentRevenue * 100).toFixed(1)}%`,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      icon: "💰"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {kpiData.map((kpi, index) => (
        <div key={index} className={`${kpi.bgColor} p-4 rounded-xl border border-gray-200`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{kpi.title}</p>
              <p className={`text-2xl font-bold ${kpi.color} mt-1`}>{kpi.value}</p>
            </div>
            <div className="text-2xl">{kpi.icon}</div>
          </div>
        </div>
      ))}
    </div>
  );
};
