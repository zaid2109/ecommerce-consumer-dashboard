import React, { useState } from 'react';

interface RFMTableRow {
  customer_id: string;
  recency: number;
  frequency: number;
  monetary: number;
  R: number;
  F: number;
  M: number;
  segment: string;
  is_top_20: boolean;
}

interface RFMTableProps {
  data: RFMTableRow[];
}

const SEGMENT_COLORS = {
  'Champions': 'bg-green-100 text-green-800',
  'Loyal Customers': 'bg-blue-100 text-blue-800',
  'Potential Loyalists': 'bg-yellow-100 text-yellow-800',
  'At Risk': 'bg-orange-100 text-orange-800',
  'Lost': 'bg-red-100 text-red-800',
  'Others': 'bg-gray-100 text-gray-800'
};

export const RFMTable: React.FC<RFMTableProps> = ({ data }) => {
  const [sortColumn, setSortColumn] = useState<keyof RFMTableRow>('monetary');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSort = (column: keyof RFMTableRow) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const sortedData = [...data].sort((a, b) => {
    const aValue = a[sortColumn];
    const bValue = b[sortColumn];
    
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortDirection === 'asc' 
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }
    
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    }
    
    return 0;
  });

  const SortIcon = ({ column }: { column: keyof RFMTableRow }) => {
    if (sortColumn !== column) return <span className="text-gray-400">↕️</span>;
    return sortDirection === 'asc' ? <span>↑</span> : <span>↓</span>;
  };

  return (
    <div className="bg-white rounded-xl shadow overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="text-lg font-semibold">RFM Customer Analysis</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th 
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('customer_id')}
              >
                Customer ID <SortIcon column="customer_id" />
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('recency')}
              >
                Recency <SortIcon column="recency" />
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('frequency')}
              >
                Frequency <SortIcon column="frequency" />
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('monetary')}
              >
                Monetary <SortIcon column="monetary" />
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('segment')}
              >
                Segment <SortIcon column="segment" />
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('is_top_20')}
              >
                Top 20% <SortIcon column="is_top_20" />
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedData.map((row, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                  {row.customer_id}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {row.recency} days
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {row.frequency}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  ${row.monetary.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-sm">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${SEGMENT_COLORS[row.segment as keyof typeof SEGMENT_COLORS]}`}>
                    {row.segment}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">
                  {row.is_top_20 ? (
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                      Yes
                    </span>
                  ) : (
                    <span className="text-gray-400">No</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
