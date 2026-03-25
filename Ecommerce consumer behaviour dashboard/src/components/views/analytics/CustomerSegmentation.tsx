"use client";

import { useMemo, useState, useEffect } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, ScatterChart, Scatter, CartesianGrid, XAxis, YAxis } from "recharts";

import { Card } from "@/components/common/Card";
import { DataTable } from "@/components/common/DataTable";
import { KPICard } from "@/components/common/KPICard";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";

// Enhanced segment types
type CustomerSegment = {
  customer_id: string;
  recency: number;
  frequency: number;
  monetary: number;
  R: number;
  F: number;
  M: number;
  segment: "Champions" | "Loyal Customers" | "Potential Loyalists" | "At Risk" | "Lost" | "Others";
  is_top_20: boolean;
};

type SegmentCounts = {
  champions: number;
  loyal: number;
  potential: number;
  at_risk: number;
  lost: number;
};

type CustomerSegmentationData = {
  total_customers: number;
  segment_counts: SegmentCounts;
  top_20_percent_revenue: number;
  rfm_table: CustomerSegment[];
  rfm_scatter: Array<{
    frequency: number;
    monetary: number;
    segment: string;
  }>;
};

type CustomerSegmentationProps = {
  data: CustomerSegmentationData;
  loading?: boolean;
  error?: string;
  onFilterChange?: (filters: any) => void;
};

const SEGMENT_COLORS = {
  Champions: "#22c55e", // green
  "Loyal Customers": "#3b82f6", // blue
  "Potential Loyalists": "#eab308", // yellow
  "At Risk": "#f97316", // orange
  Lost: "#ef4444", // red
  Others: "#6b7280", // gray
};

const SEGMENT_LABELS = {
  Champions: "Champions",
  "Loyal Customers": "Loyal Customers",
  "Potential Loyalists": "Potential Loyalists",
  "At Risk": "At Risk",
  Lost: "Lost",
  Others: "Others",
};

export function CustomerSegmentation({
  data,
  loading = false,
  error,
  onFilterChange,
}: CustomerSegmentationProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<keyof CustomerSegment>("monetary");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const rowsPerPage = 10;

  // Add error boundary for browser extension issues
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (event.message.includes('listener indicated an asynchronous response')) {
        console.warn('Browser extension communication error ignored');
        event.preventDefault();
      }
    };
    
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  // Prepare pie chart data
  const pieChartData = useMemo(() => {
    if (!data?.segment_counts) return [];
    
    return [
      { name: 'Champions', value: data.segment_counts.champions, fill: SEGMENT_COLORS.Champions },
      { name: 'Loyal Customers', value: data.segment_counts.loyal, fill: SEGMENT_COLORS['Loyal Customers'] },
      { name: 'Potential Loyalists', value: data.segment_counts.potential, fill: SEGMENT_COLORS['Potential Loyalists'] },
      { name: 'At Risk', value: data.segment_counts.at_risk, fill: SEGMENT_COLORS['At Risk'] },
      { name: 'Lost', value: data.segment_counts.lost, fill: SEGMENT_COLORS.Lost }
    ].filter(segment => segment.value > 0);
  }, [data?.segment_counts]);

  // Prepare scatter plot data
  const scatterPlotData = useMemo(() => {
    if (!data?.rfm_scatter) return [];
    
    return data.rfm_scatter.map((point) => ({
      x: point.frequency,
      y: point.monetary,
      segment: point.segment,
      fill: SEGMENT_COLORS[point.segment as keyof typeof SEGMENT_COLORS] || '#6b7280',
    }));
  }, [data?.rfm_scatter]);

  // Sort and paginate table data
  const sortedTableData = useMemo(() => {
    if (!data?.rfm_table) return [];
    
    const sorted = [...data.rfm_table].sort((a, b) => {
      const aValue = a[sortColumn];
      const bValue = b[sortColumn];
      
      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortDirection === "asc" 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortDirection === "asc" ? aValue - bValue : bValue - aValue;
      }
      
      return 0;
    });
    
    const startIndex = (currentPage - 1) * rowsPerPage;
    return sorted.slice(startIndex, startIndex + rowsPerPage);
  }, [data?.rfm_table, sortColumn, sortDirection, currentPage]);

  const totalPages = Math.ceil((data?.rfm_table?.length || 0) / rowsPerPage);

  // Handle sorting
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column as keyof CustomerSegment);
      setSortDirection("desc");
    }
    setCurrentPage(1);
  };

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <LoadingSkeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <LoadingSkeleton className="h-96" />
          <LoadingSkeleton className="h-96" />
        </div>
        <LoadingSkeleton className="h-96" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Card title="Customer Segmentation">
        <div className="text-center py-12">
          <div className="text-red-600 mb-2">⚠️</div>
          <div className="text-gray-600">{error}</div>
        </div>
      </Card>
    );
  }

  // Unavailable state
  if (!data) {
    return (
      <Card title="Customer Segmentation">
        <div className="text-center py-12">
          <div className="text-gray-400 mb-2">📊</div>
          <div className="text-gray-600">
            Customer segmentation not available (missing required columns)
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Total Customers"
          value={data.total_customers.toLocaleString()}
        />
        <KPICard
          label="Champions"
          value={data.segment_counts.champions.toLocaleString()}
          color="text-green-600"
        />
        <KPICard
          label="At Risk Customers"
          value={data.segment_counts.at_risk.toLocaleString()}
          color="text-orange-600"
        />
        <KPICard
          label="Top 20% Revenue"
          value={`${(data.top_20_percent_revenue * 100).toFixed(1)}%`}
          color="text-purple-600"
        />
      </div>

      {/* Key Insight Card */}
      <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-6 rounded-xl text-white">
        <div className="flex items-center">
          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-2">💡 Key Insight</h3>
            <p className="text-xl font-bold">
              Top 20% customers contribute {(data.top_20_percent_revenue * 100).toFixed(1)}% of total revenue
            </p>
          </div>
          <div className="text-4xl ml-4">📊</div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Segment Distribution Pie Chart */}
        <Card title="Customer Segment Distribution">
          <div className="pt-4" style={{ height: 350 }}>
            {pieChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieChartData}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={120}
                    isAnimationActive={false}
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => [value.toLocaleString(), "Customers"]}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                No segment data available
              </div>
            )}
          </div>
        </Card>

        {/* RFM Scatter Plot */}
        <Card title="RFM Analysis: Frequency vs Monetary">
          <div className="pt-4" style={{ height: 350 }}>
            {scatterPlotData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="x" 
                    name="Frequency"
                    label={{ value: "Purchase Frequency", position: "insideBottom", offset: -5 }}
                  />
                  <YAxis 
                    dataKey="y" 
                    name="Monetary"
                    label={{ value: "Monetary Value ($)", angle: -90, position: "insideLeft" }}
                  />
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      name === "Frequency" ? value : `$${value.toLocaleString()}`,
                      name
                    ]}
                    cursor={{ strokeDasharray: "3 3" }}
                  />
                  <Legend />
                  {Object.entries(SEGMENT_COLORS).map(([segment, color]) => (
                    <Scatter
                      key={segment}
                      name={SEGMENT_LABELS[segment as keyof typeof SEGMENT_LABELS]}
                      data={scatterPlotData.filter(d => d.segment === segment)}
                      fill={color}
                      isAnimationActive={false}
                    />
                  ))}
                </ScatterChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                No scatter data available
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Customer RFM Table */}
      <Card title="Enhanced RFM Analysis">
        <div className="pt-4">
          {sortedTableData.length > 0 ? (
            <DataTable
              headers={[
                {
                  key: "customer_id",
                  label: "Customer ID",
                  sortable: true,
                },
                {
                  key: "recency",
                  label: "Recency (Days)",
                  sortable: true,
                  render: (value: number) => value.toLocaleString(),
                },
                {
                  key: "frequency",
                  label: "Frequency",
                  sortable: true,
                  render: (value: number) => value.toLocaleString(),
                },
                {
                  key: "monetary",
                  label: "Monetary ($)",
                  sortable: true,
                  render: (value: number) => `$${value.toLocaleString()}`,
                },
                {
                  key: "R",
                  label: "R Score",
                  sortable: true,
                  render: (value: number) => value.toString(),
                },
                {
                  key: "F",
                  label: "F Score", 
                  sortable: true,
                  render: (value: number) => value.toString(),
                },
                {
                  key: "M",
                  label: "M Score",
                  sortable: true,
                  render: (value: number) => value.toString(),
                },
                {
                  key: "segment",
                  label: "Segment",
                  sortable: true,
                  render: (value: string) => (
                    <span
                      className="px-2 py-1 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: (SEGMENT_COLORS[value as keyof typeof SEGMENT_COLORS] || '#6b7280') + "20",
                        color: SEGMENT_COLORS[value as keyof typeof SEGMENT_COLORS] || '#6b7280',
                      }}
                    >
                      {value}
                    </span>
                  ),
                },
                {
                  key: "is_top_20",
                  label: "Top 20%",
                  sortable: true,
                  render: (value: boolean) => (
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        value 
                          ? "bg-purple-100 text-purple-800" 
                          : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      {value ? "Yes" : "No"}
                    </span>
                  ),
                },
              ]}
              rows={sortedTableData}
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              onSort={handleSort}
              pagination={{
                currentPage,
                totalPages,
                rowsPerPage,
                onPageChange: setCurrentPage,
              }}
            />
          ) : (
            <div className="text-center py-8 text-gray-500">
              No customer data available
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
