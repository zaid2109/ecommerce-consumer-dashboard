import React from 'react';
import {
  BarChart as ReBarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { BaseChart } from './BaseChart';

interface BarChartProps {
  title: string;
  data: Array<{ name: string; value: number }>;
  dataKey?: string;
  nameKey?: string;
  colors?: string[];
  xLabel?: string;
  yLabel?: string;
}

const PAYMENT_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
];

export const BarChart: React.FC<BarChartProps> = ({ 
  title, 
  data, 
  dataKey = 'value', 
  nameKey = 'name',
  colors = PAYMENT_COLORS,
  xLabel,
  yLabel
}) => {
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-300 rounded shadow">
          <p className="font-semibold">{label}</p>
          <p className="text-sm">Value: {payload[0].value.toLocaleString()}</p>
        </div>
      );
    }
    return null;
  };

  const formatYAxis = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(1)}K`;
    }
    return `$${value}`;
  };

  return (
    <BaseChart title={title}>
      <ResponsiveContainer width="100%" height={300}>
        <ReBarChart margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey={nameKey}
            angle={-45}
            textAnchor="end"
            height={100}
            label={{ value: xLabel, position: 'insideBottom', offset: -50 }}
          />
          <YAxis 
            tickFormatter={formatYAxis}
            label={{ value: yLabel, angle: -90, position: 'insideLeft' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey={dataKey} radius={[8, 8, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Bar>
        </ReBarChart>
      </ResponsiveContainer>
    </BaseChart>
  );
};
