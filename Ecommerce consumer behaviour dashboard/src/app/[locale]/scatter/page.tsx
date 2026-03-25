"use client";

import { Text, ScatterChart } from "@tremor/react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { CenteredPageWrapper } from "../../../components/common/CenteredPageWrapper";

type CustomerRow = {
  firstName: string;
  lastName: string;
  city?: string;
  country?: string;
  totalBuys?: number;
};

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

const Scatter = () => {
  const t = useTranslations("singleCharts.scatter");
  const [customers, setCustomers] = useState<CustomerRow[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${backendUrl}/customers`, { cache: "no-store", signal: controller.signal })
      .then((res) => res.json())
      .then((json) => setCustomers(json?.data?.items ?? []))
      .catch(() => setCustomers([]));
    return () => controller.abort();
  }, []);

  const maxSpend = useMemo(
    () => Math.max(1, ...customers.map((row) => Number(row.totalBuys ?? 0))),
    [customers]
  );

  const chartdata = useMemo(
    () =>
      customers.slice(0, 40).map((row) => {
        const spend = Number(row.totalBuys ?? 0);
        const normalized = 60 + (spend / maxSpend) * 40;
        return {
          [t("country")]: row.city || row.country || "Unknown",
          [t("lifeExpectancy")]: Number(normalized.toFixed(1)),
          [t("gdp")]: spend,
          [t("population")]: spend,
        };
      }),
    [customers, maxSpend, t]
  );

  return (
    <CenteredPageWrapper>
      <div className="text-lg 1xl:text-xl 3xl:text-2xl w-full text-left mb-6 text-primaryText">
        {t("title")}
      </div>
      <Text>{t("subtitle")} </Text>
      <ScatterChart
        className="h-56 1xl:h-72 3xl:h-80 mt-6 -ml-2"
        yAxisWidth={50}
        data={chartdata}
        category={t("country")}
        x={t("gdp")}
        y={t("lifeExpectancy")}
        size={t("population")}
        showOpacity={true}
        minYValue={60}
        valueFormatter={{
          x: (amount) => `$${(amount / 1000).toFixed(1)}K`,
          y: (lifeExp) => `${lifeExp} ${t("yrs")}`,
          size: (population) => `${(population / 1000000).toFixed(1)}M`,
        }}
        showLegend={false}
      />
    </CenteredPageWrapper>
  );
};

export default Scatter;
