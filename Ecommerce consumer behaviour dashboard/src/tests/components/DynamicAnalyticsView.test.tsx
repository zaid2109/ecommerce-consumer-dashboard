import React from "react";
import { render, screen, waitFor } from "@testing-library/react";

import { DynamicAnalyticsView } from "../../components/views/analytics/DynamicAnalyticsView";

type FetchMock = jest.MockedFunction<typeof fetch>;

jest.mock("next/navigation", () => {
  return {
    useRouter: () => ({ push: jest.fn() }),
    useSearchParams: () => ({
      get: (key: string) => {
        if (key === "datasetId") return null;
        if (key === "tab") return null;
        return null;
      },
    }),
  };
});

jest.mock("recharts", () => {
  const Mock = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Mock,
    AreaChart: Mock,
    Area: Mock,
    BarChart: Mock,
    Bar: Mock,
    LineChart: Mock,
    Line: Mock,
    PieChart: Mock,
    Pie: Mock,
    ScatterChart: Mock,
    Scatter: Mock,
    CartesianGrid: Mock,
    Cell: Mock,
    Legend: Mock,
    Tooltip: Mock,
    XAxis: Mock,
    YAxis: Mock,
  };
});

const makeFetch = (dashboardModules: Array<{ id: string; title: string; status: string; data?: object; reason?: string }>) => {
  return jest.fn(async (url: RequestInfo | URL) => {
    const textUrl = String(url);

    if (textUrl.includes("/api/datasets")) {
      return {
        ok: true,
        json: async () => ({
          status: "ok",
          data: [
            {
              dataset_id: "ds_test",
              created_at: new Date().toISOString(),
              row_count: 2,
              columns: ["a", "b"],
              source_file_name: "sample.csv",
            },
          ],
        }),
      } as Response;
    }

    if (textUrl.includes("/api/dataset/ds_test/dashboard")) {
      return {
        ok: true,
        json: async () => ({
          status: "ok",
          data: {
            modules: dashboardModules,
            filterOptions: { category: [], paymentMethod: [] },
            profile: { quality: { quality_score: 1, warnings: [] } },
          },
        }),
      } as Response;
    }

    throw new Error(`Unhandled fetch url: ${textUrl}`);
  });
};

describe("DynamicAnalyticsView", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("renders without crashing and performs a mocked API call", async () => {
    // Provide enough modules to satisfy the component's overview rendering path.
    (globalThis as typeof globalThis & { fetch: FetchMock }).fetch = makeFetch([
      { id: "kpis", title: "KPIs", status: "ok", data: { revenue: 100, orders: 2, quantity: 3 } },
      { id: "time-series", title: "Revenue Over Time", status: "ok", data: { series: [{ bucket: "2025-01-01", value: 100 }] } },
      { id: "revenue-by-category", title: "Revenue By Category", status: "ok", data: { categories: [{ name: "A", revenue: 100 }] } },
      { id: "payment-analysis", title: "Payment Analysis", status: "ok", data: { paymentMethods: [] } },
      { id: "returns", title: "Returns", status: "ok", data: { byStatus: [] } },
      { id: "customer-segments", title: "Customer Segments", status: "ok", data: { segments: [] } },
      { id: "insights", title: "Insights", status: "ok", data: { insights: [] } },
      { id: "recommendations", title: "Recommendations", status: "ok", data: { popular: [] } },
      { id: "anomalies", title: "Anomalies", status: "ok", data: { anomalies: [] } },
      { id: "clv", title: "CLV", status: "ok", data: { featureImportance: [] } },
    ]);

    render(<DynamicAnalyticsView activeTab="purchase-frequency" setActiveTab={jest.fn()} />);

    // flush setTimeout(0) for datasets, then setTimeout(200) for dashboard fetch
    jest.runOnlyPendingTimers();
    jest.advanceTimersByTime(250);

    await waitFor(() => {
      expect(screen.getByText("Executive Summary")).toBeInTheDocument();
    });
  });

  it("renders module cards when data is present and shows unavailable state when missing", async () => {
    (globalThis as typeof globalThis & { fetch: FetchMock }).fetch = makeFetch([
      { id: "kpis", title: "KPIs", status: "ok", data: { revenue: 100, orders: 2, quantity: 3 } },
      { id: "time-series", title: "Revenue Over Time", status: "unavailable", reason: "missing_required_roles" },
      { id: "revenue-by-category", title: "Revenue By Category", status: "ok", data: { categories: [{ name: "A", revenue: 100 }] } },
      { id: "insights", title: "Insights", status: "ok", data: { insights: [] } },
    ]);

    render(<DynamicAnalyticsView activeTab="purchase-frequency" setActiveTab={jest.fn()} />);

    jest.runOnlyPendingTimers();
    jest.advanceTimersByTime(250);

    await waitFor(() => {
      expect(screen.getByText("Executive Summary")).toBeInTheDocument();
    });

    // time-series should show an unavailable message instead of chart
    expect(screen.getByText("Revenue Over Time")).toBeInTheDocument();
    expect(screen.getAllByText(/missing_required_roles|Unavailable/i).length).toBeGreaterThan(0);
  });
});
