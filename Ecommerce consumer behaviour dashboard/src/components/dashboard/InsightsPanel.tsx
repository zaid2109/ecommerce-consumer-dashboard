import React from "react";

import { Card } from "../common/Card";

type InsightsPanelProps = {
  insights: string[];
  title?: string;
};

export const InsightsPanel = ({ insights, title = "Insights" }: InsightsPanelProps) => {
  return (
    <Card title={title}>
      <div className="pt-4 grid grid-cols-1 gap-2">
        {(insights.length ? insights : ["No insights available."]).map((message, index) => (
          <div
            key={`${index}-${message}`}
            className="rounded-md border border-mainBorder bg-inputBg px-3 py-2 text-sm text-secondaryText"
          >
            {message}
          </div>
        ))}
      </div>
    </Card>
  );
};
