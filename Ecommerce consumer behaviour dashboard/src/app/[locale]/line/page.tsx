"use client";

import { LineChart } from "@tremor/react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { CenteredPageWrapper } from "../../../components/common/CenteredPageWrapper";
import { useTheme } from "next-themes";
import { useWindowDimensions } from "../../../hooks/useWindowDimensions";

type SeriesRow = {
  bucket: string;
  value: number;
};

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

const Line = () => {
  const t = useTranslations("singleCharts.line");
  const { width: windowWidth } = useWindowDimensions();
  const [series, setSeries] = useState<SeriesRow[]>([]);

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
        setSeries([]);
        return;
      }
      const dashboardRes = await fetch(
        `${backendUrl}/dashboard?dataset_id=${datasetId}`,
        { cache: "no-store", signal: controller.signal }
      );
      const dashboardJson = await dashboardRes.json();
      const moduleData = dashboardJson?.data?.data?.modules?.find(
        (item: { id: string }) => item.id === "time-series"
      );
      const rows = moduleData?.data?.series ?? [];
      setSeries(rows);
    };
    load().catch(() => setSeries([]));
    return () => controller.abort();
  }, []);

  const chartData = useMemo(() => {
    if (!series.length) {
      return [];
    }
    return series.map((row, index) => {
      const slice = series.slice(Math.max(0, index - 6), index + 1);
      const average =
        slice.reduce((total, item) => total + Number(item.value ?? 0), 0) / slice.length;
      const label = windowWidth > 600 ? row.bucket : row.bucket.slice(5);
      return {
        year: label,
        [t("sales")]: Number(row.value ?? 0),
        [t("revenue")]: Number(average.toFixed(2)),
      };
    });
  }, [series, t, windowWidth]);

  const dataFormatter = (number: number) =>
    `${Intl.NumberFormat("us").format(number).toString()}`;

  const { theme } = useTheme();

  const colorSchemes: { [key: string]: string } = {
    obsidian: "emerald",
    midnight: "cyan",
    charcoal: "blue",
    snowlight: "blue",
  };

  const defaultTheme = "midnight";
  const mainLineColor = colorSchemes[theme || defaultTheme];

  return (
    <CenteredPageWrapper>
      <div className="text-lg 1xl:text-xl 3xl:text-2xl w-full text-left mb-6 text-primaryText">
        {t("title")}
      </div>
      <LineChart
        className="mt-2 1xl:mt-6 h-56 1xl:h-72 3xl:h-80"
        data={chartData}
        index="year"
        categories={[t("sales"), t("revenue")]}
        colors={[mainLineColor, "slate"]}
        valueFormatter={dataFormatter}
        yAxisWidth={40}
        intervalType="preserveStartEnd"
      />
    </CenteredPageWrapper>
  );
};

export default Line;
