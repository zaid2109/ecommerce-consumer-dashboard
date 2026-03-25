import React from 'react';

interface BaseChartProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export const BaseChart: React.FC<BaseChartProps> = ({ title, children, className = "" }) => {
  return (
    <div className={`bg-white p-4 rounded-2xl shadow ${className}`}>
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      {children}
    </div>
  );
};
