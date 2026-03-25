"use client";

import { Component, ReactNode } from "react";

import { Card } from "../../common/Card";

type DashboardErrorBoundaryProps = {
  children: ReactNode;
};

type DashboardErrorBoundaryState = {
  hasError: boolean;
  errorRef: string;
};

export class DashboardErrorBoundary extends Component<
  DashboardErrorBoundaryProps,
  DashboardErrorBoundaryState
> {
  state: DashboardErrorBoundaryState = {
    hasError: false,
    errorRef: "",
  };

  static getDerivedStateFromError() {
    return {
      hasError: true,
      errorRef: `ui_${crypto.randomUUID().slice(0, 8)}`,
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card title="Dashboard Error">
          <div className="pt-5 text-primaryText">
            <p className="text-sm 1xl:text-base">A rendering error occurred.</p>
            <p className="text-xs 1xl:text-sm mt-2 text-secondaryText">
              Reference: {this.state.errorRef}
            </p>
          </div>
        </Card>
      );
    }
    return this.props.children;
  }
}
