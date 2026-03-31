import {
  Building2,
  FolderOpen,
  Users,
  Activity,
  Coins,
  DollarSign,
  BrainCircuit,
} from "lucide-react";
import { type LucideIcon } from "lucide-react";
import { compactNumberFormatter, usdFormatter } from "@/src/utils/numbers";

type Summary =
  | { totalOrgs: number; totalProjects: number; totalMembers: number }
  | undefined;

type UsageMetrics =
  | {
      totalTraces: number;
      totalTokens: number;
      totalCost: number;
      uniqueModels: number;
    }
  | undefined;

function SummaryTile({
  name,
  value,
  icon: Icon,
  isLoading,
}: {
  name: string;
  value: string | undefined;
  icon: LucideIcon;
  isLoading: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card px-4 py-5 shadow-sm sm:p-6">
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <dt className="truncate text-sm font-medium text-muted-foreground">
            {name}
          </dt>
          <dd className="mt-0.5 text-3xl font-semibold tracking-tight text-primary">
            {isLoading ? "—" : (value ?? "0")}
          </dd>
        </div>
      </div>
    </div>
  );
}

export function OrgDashboardSummaryTiles({
  summary,
  isLoading,
  usageMetrics,
  isUsageLoading,
}: {
  summary: Summary;
  isLoading: boolean;
  usageMetrics?: UsageMetrics;
  isUsageLoading?: boolean;
}) {
  return (
    <div className="space-y-4">
      {/* Structural tiles (always fast) */}
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryTile
          name="Organizations"
          value={summary?.totalOrgs?.toLocaleString()}
          icon={Building2}
          isLoading={isLoading}
        />
        <SummaryTile
          name="Projects"
          value={summary?.totalProjects?.toLocaleString()}
          icon={FolderOpen}
          isLoading={isLoading}
        />
        <SummaryTile
          name="Members"
          value={summary?.totalMembers?.toLocaleString()}
          icon={Users}
          isLoading={isLoading}
        />
      </dl>

      {/* Usage metric tiles (ClickHouse, date-scoped) */}
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryTile
          name="Total Traces"
          value={
            usageMetrics
              ? compactNumberFormatter(usageMetrics.totalTraces)
              : undefined
          }
          icon={Activity}
          isLoading={isUsageLoading ?? false}
        />
        <SummaryTile
          name="Total Tokens"
          value={
            usageMetrics
              ? compactNumberFormatter(usageMetrics.totalTokens)
              : undefined
          }
          icon={Coins}
          isLoading={isUsageLoading ?? false}
        />
        <SummaryTile
          name="Total Cost"
          value={
            usageMetrics
              ? usdFormatter(usageMetrics.totalCost, 2, 2)
              : undefined
          }
          icon={DollarSign}
          isLoading={isUsageLoading ?? false}
        />
        <SummaryTile
          name="Models Used"
          value={
            usageMetrics
              ? String(usageMetrics.uniqueModels)
              : undefined
          }
          icon={BrainCircuit}
          isLoading={isUsageLoading ?? false}
        />
      </dl>
    </div>
  );
}

