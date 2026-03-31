import Link from "next/link";
import { DashboardCard } from "@/src/features/dashboard/components/cards/DashboardCard";
import { DashboardTable } from "@/src/features/dashboard/components/cards/DashboardTable";
import { RightAlignedCell } from "@/src/features/dashboard/components/RightAlignedCell";
import { LeftAlignedCell } from "@/src/features/dashboard/components/LeftAlignedCell";
import {
  compactNumberFormatter,
  usdFormatter,
} from "@/src/utils/numbers";
import { FolderOpen } from "lucide-react";

type ProjectRow = {
  projectId: string;
  projectName: string;
  traceCount: number;
  totalTokens: number;
  totalCost: number;
};

export function OrgDashboardProjectBreakdownTable({
  className,
  data,
  isLoading,
}: {
  className?: string;
  data: ProjectRow[] | undefined;
  isLoading: boolean;
}) {
  const rows = data
    ? data.map((row, i) => [
        <LeftAlignedCell key={`${i}-name`} title={row.projectName}>
          <Link
            href={`/project/${row.projectId}`}
            className="flex items-center gap-1.5 hover:underline"
          >
            <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{row.projectName}</span>
          </Link>
        </LeftAlignedCell>,
        <RightAlignedCell key={`${i}-traces`}>
          {compactNumberFormatter(row.traceCount)}
        </RightAlignedCell>,
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
      title="Project Breakdown"
      isLoading={isLoading}
    >
      <DashboardTable
        headers={[
          "Project",
          <RightAlignedCell key="traces">Traces</RightAlignedCell>,
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
