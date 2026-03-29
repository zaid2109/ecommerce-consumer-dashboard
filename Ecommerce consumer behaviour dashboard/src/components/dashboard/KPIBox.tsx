import React from "react";

import { KPICard } from "../common/KPICard";

type KPIBoxProps = {
  label: string;
  value: string | number;
  color?: string;
};

export const KPIBox = ({ label, value, color }: KPIBoxProps) => {
  return <KPICard label={label} value={value} color={color} />;
};
