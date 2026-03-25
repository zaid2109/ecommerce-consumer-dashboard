import React from 'react';
import {
  PieChart as RePieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { BaseChart } from './BaseChart';

interface PieChartProps {
  title: string;
  data: Array<{ name: string; value: number }>;
  dataKey?: string;
  nameKey?: string;
  colors?: string[];
  showLegend?: boolean;
}

const SEGMENT_COLORS = {
  'Champions': '#22c55e',
  'Loyal Customers': '#3b82f6',
  'Potential Loyalists': '#eab308',
  'At Risk': '#f97316',
  'Lost': '#ef4444',
  'Others': '#6b7280'
};

export const PieChart: React.FC<PieChartProps> = ({ 
  title, 
  data, 
  dataKey = 'value', 
  nameKey = 'name',
  colors,
  showLegend = true 
}) => {
  const getSegmentColor = (segmentName: string) => {
    if (colors) return colors[data.indexOf(data.find(d => d.name === segmentName)!) % colors.length];
    return SEGMENT_COLORS[segmentName as keyof typeof SEGMENT_COLORS] || '#6b7280';
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-2 border border-gray-300 rounded shadow">
          <p className="font-semibold">{payload[0].name}</p>
          <p className="text-sm">Count: {payload[0].value}</p>
          <p className="text-sm">Percentage: {((payload[0].value / data.reduce((sum, item) => sum + item.value, 0)) * 100).toFixed(1)}%</p>
        </div>
      );
    }
    return null;
  };

  return (
    <BaseChart title={title}>
      <ResponsiveContainer width="100%" height={300}>
        <RePieChart>
          <Pie
            data={data}
            dataKey={dataKey}
            nameKey={nameKey}
            cx="50%"
            cy="50%"
            outerRadius={100}
            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getSegmentColor(entry.name)} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          {showLegend && <Legend />}
        </RePieChart>
      </ResponsiveContainer>
    </BaseChart>
  );
};
