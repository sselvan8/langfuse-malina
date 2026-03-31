import { useState } from "react";
import { DashboardCard } from "@/src/features/dashboard/components/cards/DashboardCard";
import { TabComponent } from "@/src/features/dashboard/components/TabsComponent";
import { TotalMetric } from "@/src/features/dashboard/components/TotalMetric";
import { ExpandListButton } from "@/src/features/dashboard/components/cards/ChevronButton";
import { NoDataOrLoading } from "@/src/components/NoDataOrLoading";
import { Chart } from "@/src/features/widgets/chart-library/Chart";
import { barListToDataPoints } from "@/src/features/dashboard/lib/chart-data-adapters";
import {
  compactNumberFormatter,
  usdFormatter,
} from "@/src/utils/numbers";

type UserRow = {
  userId: string;
  totalCost: number;
  totalTokens: number;
  traceCount: number;
};

const BAR_ROW_HEIGHT = 36;
const CHART_AXIS_PADDING = 32;
const MAX_COLLAPSED = 5;
const MAX_EXPANDED = 10;

export function OrgDashboardTopUsersChart({
  className,
  data,
  isLoading,
}: {
  className?: string;
  data: UserRow[] | undefined;
  isLoading: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const costData = (data ?? []).map((r) => ({
    name: r.userId,
    value: r.totalCost,
  }));

  const traceData = (data ?? []).map((r) => ({
    name: r.userId,
    value: r.traceCount,
  }));

  const totalCost = costData.reduce((acc, r) => acc + r.value, 0);
  const totalTraces = traceData.reduce((acc, r) => acc + r.value, 0);

  const tabs = [
    {
      tabTitle: "Token cost",
      data: isExpanded
        ? costData.slice(0, MAX_EXPANDED)
        : costData.slice(0, MAX_COLLAPSED),
      totalMetric: usdFormatter(totalCost, 2, 2),
      metricDescription: "Total cost",
      formatter: (v: number) => usdFormatter(v, 2, 2),
    },
    {
      tabTitle: "Count of Traces",
      data: isExpanded
        ? traceData.slice(0, MAX_EXPANDED)
        : traceData.slice(0, MAX_COLLAPSED),
      totalMetric: compactNumberFormatter(totalTraces),
      metricDescription: "Total traces",
      formatter: (v: number) => compactNumberFormatter(v),
    },
  ];

  return (
    <DashboardCard
      className={className}
      title="Top 10 Users by Consumption"
      isLoading={isLoading}
    >
      <TabComponent
        tabs={tabs.map((item) => ({
          tabTitle: item.tabTitle,
          content: (
            <>
              {item.data.length > 0 ? (
                <div className="flex flex-col">
                  <TotalMetric
                    metric={item.totalMetric}
                    description={item.metricDescription}
                  />
                  <div
                    className="mt-4 w-full"
                    style={{
                      minHeight: 200,
                      height: Math.max(
                        200,
                        item.data.length * BAR_ROW_HEIGHT + CHART_AXIS_PADDING,
                      ),
                    }}
                  >
                    <Chart
                      chartType="HORIZONTAL_BAR"
                      data={barListToDataPoints(item.data)}
                      rowLimit={MAX_EXPANDED}
                      chartConfig={{
                        type: "HORIZONTAL_BAR",
                        row_limit: MAX_EXPANDED,
                        show_value_labels: true,
                        subtle_fill: true,
                      }}
                      valueFormatter={item.formatter}
                    />
                  </div>
                </div>
              ) : (
                <NoDataOrLoading
                  isLoading={isLoading}
                  description="User consumption is tracked by passing user IDs on traces."
                  href="https://langfuse.com/docs/observability/features/users"
                />
              )}
            </>
          ),
        }))}
      />
      <ExpandListButton
        isExpanded={isExpanded}
        setExpanded={setIsExpanded}
        totalLength={costData.length}
        maxLength={MAX_COLLAPSED}
        expandText="Show all"
      />
    </DashboardCard>
  );
}
