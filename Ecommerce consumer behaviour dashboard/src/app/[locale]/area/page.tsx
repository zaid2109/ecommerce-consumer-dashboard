"use client";

import { AreaChart } from "@tremor/react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { CenteredPageWrapper } from "../../../components/common/CenteredPageWrapper";

type RevenueRow = {
  date: string;
  websiteSales?: number;
  inStoreSales?: number;
};

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

const Area = () => {
  const dataFormatter = (number: number) => {
    return Intl.NumberFormat("us").format(number).toString();
  };

  const { theme } = useTheme();
  const t = useTranslations("singleCharts.area");
  const [rows, setRows] = useState<RevenueRow[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${backendUrl}/homepage`, { cache: "no-store", signal: controller.signal })
      .then((res) => res.json())
      .then((json) => {
        setRows(json?.data?.revenueOverTime ?? []);
      })
      .catch(() => {
        setRows([]);
      });
    return () => controller.abort();
  }, []);

  const chartdata = useMemo(
    () =>
      rows.map((row) => ({
        date: row.date,
        [t("views")]: row.websiteSales ?? 0,
        [t("uniqueVisitors")]: row.inStoreSales ?? 0,
      })),
    [rows, t]
  );

  const colorSchemes: { [key: string]: string[] } = {
    obsidian: ["gray", "emerald"],
    midnight: ["indigo", "cyan"],
    charcoal: ["gray", "blue"],
  };

  const defaultTheme = "midnight";
  const selectedColors = colorSchemes[theme || defaultTheme];

  return (
    <CenteredPageWrapper>
      <>
        <div className="text-lg 1xl:text-xl 3xl:text-2xl w-full text-left mb-4 1xl:mb-6 text-primaryText">
          {t("title")}
        </div>
        <AreaChart
          className="h-72 1xl:h-80 3xl:h-96 3xl:mt-4"
          data={chartdata}
          index="date"
          categories={[t("views"), t("uniqueVisitors")]}
          colors={selectedColors}
          valueFormatter={dataFormatter}
        />
      </>
    </CenteredPageWrapper>
  );
};

export default Area;
