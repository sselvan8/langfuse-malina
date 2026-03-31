import { DashboardCard } from "@/src/features/dashboard/components/cards/DashboardCard";
import { DashboardTable } from "@/src/features/dashboard/components/cards/DashboardTable";
import { RightAlignedCell } from "@/src/features/dashboard/components/RightAlignedCell";
import { LeftAlignedCell } from "@/src/features/dashboard/components/LeftAlignedCell";
import {
  compactNumberFormatter,
  usdFormatter,
} from "@/src/utils/numbers";
import { truncate } from "@/src/utils/string";

type ModelRow = {
  model: string;
  totalTokens: number;
  totalCost: number;
};

export function OrgDashboardModelBreakdownTable({
  className,
  data,
  isLoading,
}: {
  className?: string;
  data: ModelRow[] | undefined;
  isLoading: boolean;
}) {
  const rows = data
    ? data.map((row, i) => [
        <LeftAlignedCell key={`${i}-model`} title={row.model}>
          {truncate(row.model, 30)}
        </LeftAlignedCell>,
        <RightAlignedCell key={`${i}-tokens`}>
          {compactNumberFormatter(row.totalTokens)}
        </RightAlignedCell>,
        <RightAlignedCell key={`${i}-cost`}>
          {usdFormatter(row.totalCost, 2, 2)}
        </RightAlignedCell>,
      ])
    : [];

  return (
    <DashboardCard
      className={className}
      title="Model Breakdown"
      isLoading={isLoading}
    >
      <DashboardTable
        headers={[
          "Model",
          <RightAlignedCell key="tokens">Tokens</RightAlignedCell>,
          <RightAlignedCell key="cost">Cost</RightAlignedCell>,
        ]}
        rows={rows}
        isLoading={isLoading}
        collapse={{ collapsed: 5, expanded: 20 }}
      />
    </DashboardCard>
  );
}
