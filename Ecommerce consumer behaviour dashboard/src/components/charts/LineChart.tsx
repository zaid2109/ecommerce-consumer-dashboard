import React from 'react';
import {
  LineChart as ReLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { BaseChart } from './BaseChart';

interface LineChartProps {
  title: string;
  data: Array<{ name: string; value: number }>;
  dataKey?: string;
  nameKey?: string;
  color?: string;
  xLabel?: string;
  yLabel?: string;
}

export const LineChart: React.FC<LineChartProps> = ({ 
  title, 
  data, 
  dataKey = 'value', 
  nameKey = 'name',
  color = '#3b82f6',
  xLabel,
  yLabel
}) => {
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-300 rounded shadow">
          <p className="font-semibold">{label}</p>
          <p className="text-sm">Returns: {payload[0].value.toLocaleString()}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <BaseChart title={title}>
      <ResponsiveContainer width="100%" height={300}>
        <ReLineChart margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey={nameKey}
            angle={-45}
            textAnchor="end"
            height={100}
            label={{ value: xLabel, position: 'insideBottom', offset: -50 }}
          />
          <YAxis 
            label={{ value: yLabel, angle: -90, position: 'insideLeft' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Line 
            type="monotone" 
            dataKey={dataKey} 
            stroke={color}
            strokeWidth={2}
            dot={{ fill: color, strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6 }}
          />
        </ReLineChart>
      </ResponsiveContainer>
    </BaseChart>
  );
};
