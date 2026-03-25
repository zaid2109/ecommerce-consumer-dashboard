"use client";

import { useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { PageWrapper } from "../../../components/common/PageWrapper";
import { DynamicAnalyticsView } from "../../../components/views/analytics/DynamicAnalyticsView";

const TABS = [
  { id: "purchase-frequency", label: "Purchase Frequency" },
  { id: "category-revenue", label: "Category Revenue" },
  { id: "customer-segmentation", label: "Customer Segmentation" },
  { id: "payment-analysis", label: "Payment Analysis" },
  { id: "returns-refunds", label: "Returns & Refunds" },
] as const;

type TabKey = typeof TABS[number]["id"];
const TAB_IDS = new Set(TABS.map((tab) => tab.id));

const Analytics = () => {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabKey>("purchase-frequency");

  const currentTabLabel = useMemo(() => {
    const tab = TABS.find((t) => t.id === activeTab);
    return tab?.label ?? "Analytics";
  }, [activeTab]);

  return (
    <PageWrapper
      className="px-4 pt-28 pb-4 xl:p-0"
      hidePaper
      pageName="Analytics"
      dynamicPageName={currentTabLabel}
    >
      <DynamicAnalyticsView activeTab={activeTab} setActiveTab={setActiveTab} />
    </PageWrapper>
  );
};

export default Analytics;
