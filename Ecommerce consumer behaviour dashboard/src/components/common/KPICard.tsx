import React from "react";

interface KPICardProps {
  label: string;
  value: string | number;
  color?: string;
}

export function KPICard({ label, value, color = "text-gray-900" }: KPICardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
      <div className="text-sm font-medium text-gray-600 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}
