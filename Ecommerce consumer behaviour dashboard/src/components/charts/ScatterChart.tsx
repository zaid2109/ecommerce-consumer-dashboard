import React from 'react';
import {
  ScatterChart as ReScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { BaseChart } from './BaseChart';

interface ScatterChartProps {
  title: string;
  data: Array<{ frequency: number; monetary: number; segment: string }>;
  xKey?: string;
  yKey?: string;
}

const SEGMENT_COLORS = {
  'Champions': '#22c55e',
  'Loyal Customers': '#3b82f6',
  'Potential Loyalists': '#eab308',
  'At Risk': '#f97316',
  'Lost': '#ef4444',
  'Others': '#6b7280'
};

export const ScatterChart: React.FC<ScatterChartProps> = ({ 
  title, 
  data, 
  xKey = 'frequency', 
  yKey = 'monetary' 
}) => {
  const getSegmentColor = (segmentName: string) => {
    return SEGMENT_COLORS[segmentName as keyof typeof SEGMENT_COLORS] || '#6b7280';
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-300 rounded shadow">
          <p className="font-semibold mb-2">{data.segment}</p>
          <p className="text-sm">Frequency: {data.frequency}</p>
          <p className="text-sm">Monetary: ${data.monetary.toFixed(2)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <BaseChart title={title}>
      <ResponsiveContainer width="100%" height={400}>
        <ReScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            type="number" 
            dataKey={xKey} 
            name="Frequency"
            label={{ value: 'Purchase Frequency', position: 'insideBottom', offset: -10 }}
          />
          <YAxis 
            type="number" 
            dataKey={yKey} 
            name="Monetary"
            label={{ value: 'Monetary Value ($)', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
          <Scatter name="Customers" data={data} fill="#8884d8">
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getSegmentColor(entry.segment)} />
            ))}
          </Scatter>
        </ReScatterChart>
      </ResponsiveContainer>
    </BaseChart>
  );
};
