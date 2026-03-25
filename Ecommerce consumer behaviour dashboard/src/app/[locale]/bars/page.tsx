"use client";

import { BarChart } from "@tremor/react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { CenteredPageWrapper } from "../../../components/common/CenteredPageWrapper";

type CategoryRow = {
  name: string;
  revenue: number;
};

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

const Bars = () => {
  const t = useTranslations("singleCharts.bars");
  const [categories, setCategories] = useState<CategoryRow[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      const datasetsRes = await fetch(`${backendUrl}/datasets`, {
        cache: "no-store",
        signal: controller.signal,
      });
      const datasetsJson = await datasetsRes.json();
      const datasetId = datasetsJson?.data?.[0]?.dataset_id;
      if (!datasetId) {
        setCategories([]);
        return;
      }
      const dashboardRes = await fetch(
        `${backendUrl}/dashboard?dataset_id=${datasetId}`,
        { cache: "no-store", signal: controller.signal }
      );
      const dashboardJson = await dashboardRes.json();
      const moduleData = dashboardJson?.data?.data?.modules?.find(
        (item: { id: string }) => item.id === "revenue-by-category"
      );
      const rows = moduleData?.data?.categories ?? [];
      setCategories(rows);
    };
    load().catch(() => setCategories([]));
    return () => controller.abort();
  }, []);

  const barChartData = useMemo(
    () =>
      categories.map((row) => ({
        name: row.name ?? "Unknown",
        [t("modules")]: row.revenue ?? 0,
      })),
    [categories, t]
  );

  const dataFormatter = (number: number) => {
    return "$ " + Intl.NumberFormat("us").format(number).toString();
  };

  return (
    <CenteredPageWrapper>
      <>
        <div className="text-lg 1xl:text-xl 3xl:text-2xl w-full text-left mb-6 md:mb-6 text-primaryText">
          {t("title")}
        </div>
        <BarChart
          className="h-64 1xl:h-80 3xl:mt-6 single-chart-bars"
          data={barChartData}
          index="name"
          categories={[t("modules")]}
          colors={["blue"]}
          valueFormatter={dataFormatter}
          yAxisWidth={48}
        />
      </>
    </CenteredPageWrapper>
  );
};

export default Bars;
