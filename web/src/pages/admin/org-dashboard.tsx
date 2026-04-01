import { useSession } from "next-auth/react";
import { useState, useMemo, useEffect } from "react";
import { api } from "@/src/utils/api";
import { ErrorPage } from "@/src/components/error-page";
import ContainerPage from "@/src/components/layouts/container-page";
import { NoDataOrLoading } from "@/src/components/NoDataOrLoading";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { OrgDashboardSummaryTiles } from "@/src/features/org-dashboard/components/OrgDashboardSummaryTiles";
import { OrgDashboardOrgCard } from "@/src/features/org-dashboard/components/OrgDashboardOrgCard";
import { OrgDashboardProjectBreakdownTable } from "@/src/features/org-dashboard/components/OrgDashboardProjectBreakdownTable";
import { OrgDashboardModelBreakdownTable } from "@/src/features/org-dashboard/components/OrgDashboardModelBreakdownTable";
import { OrgDashboardTopUsersChart } from "@/src/features/org-dashboard/components/OrgDashboardTopUsersChart";
import { useDashboardDateRange } from "@/src/hooks/useDashboardDateRange";
import { DashboardDateRangeDropdown } from "@/src/components/date-range-dropdowns";
import {
  toAbsoluteTimeRange,
  DASHBOARD_AGGREGATION_PLACEHOLDER,
  type DashboardDateRangeOptions,
} from "@/src/utils/date-range-utils";

export default function OrgDashboardPage() {
  const { data: session, status } = useSession();
  const [selectedOrgId, setSelectedOrgId] = useState<string>("all");
  const { timeRange, setTimeRange } = useDashboardDateRange({
    defaultRelativeAggregation: "last30Days",
  });

  const hasAccess = Boolean(session?.user?.canViewOrgDashboard);
  const isOrgAdmin = Boolean(session?.user?.isOrgDashboardAdmin);

  const absoluteTimeRange = useMemo(
    () => toAbsoluteTimeRange(timeRange),
    [timeRange],
  );

  const usageEnabled =
    hasAccess && absoluteTimeRange !== null;

  const usageInput = usageEnabled
    ? {
        orgId: selectedOrgId,
        fromTimestamp: absoluteTimeRange.from.toISOString(),
        toTimestamp: absoluteTimeRange.to.toISOString(),
      }
    : null;

  const summary = api.orgDashboard.summary.useQuery(undefined, {
    enabled: hasAccess,
  });

  const orgsQuery = api.orgDashboard.orgList.useQuery(undefined, {
    enabled: hasAccess,
  });

  // For org owners with a single org, auto-select their org
  useEffect(() => {
    if (!isOrgAdmin && orgsQuery.data?.length === 1) {
      setSelectedOrgId(orgsQuery.data[0].id);
    }
  }, [isOrgAdmin, orgsQuery.data]);

  const usageMetrics = api.orgDashboard.orgUsageMetrics.useQuery(
    usageInput!,
    { enabled: !!usageInput },
  );

  const projectBreakdown = api.orgDashboard.projectBreakdown.useQuery(
    usageInput!,
    { enabled: !!usageInput },
  );

  const modelBreakdown = api.orgDashboard.modelBreakdown.useQuery(
    usageInput!,
    { enabled: !!usageInput },
  );

  const topUsers = api.orgDashboard.topUsers.useQuery(
    usageInput!,
    { enabled: !!usageInput },
  );

  const filteredOrgs = useMemo(() => {
    if (!orgsQuery.data) return [];
    if (selectedOrgId === "all") return orgsQuery.data;
    return orgsQuery.data.filter((o) => o.id === selectedOrgId);
  }, [orgsQuery.data, selectedOrgId]);

  if (status === "loading") {
    return (
      <ContainerPage headerProps={{ title: "Org Dashboard" }}>
        <NoDataOrLoading isLoading={true} />
      </ContainerPage>
    );
  }

  if (!hasAccess) {
    return (
      <ErrorPage
        title="Access Denied"
        message="You don't have permission to view the Org Dashboard."
      />
    );
  }

  return (
    <ContainerPage
      headerProps={{
        title: "Org Dashboard",
        help: {
          description:
            "Cross-organization overview showing usage metrics, costs, and member counts.",
        },
      }}
    >
      {/* Controls bar */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        {/* Show org selector when admin has multiple orgs, or org owner has multiple owned orgs */}
        {(isOrgAdmin || (orgsQuery.data && orgsQuery.data.length > 1)) && (
          <>
            <span className="text-sm font-medium text-muted-foreground">
              Organization:
            </span>
            <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
              <SelectTrigger className="w-56">
                <SelectValue
                  placeholder={
                    isOrgAdmin ? "All Organizations" : "All My Organizations"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {isOrgAdmin ? "All Organizations" : "All My Organizations"}
                </SelectItem>
                {orgsQuery.data?.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}

        <span className="text-sm font-medium text-muted-foreground">
          Date range:
        </span>
        <DashboardDateRangeDropdown
          selectedOption={
            ("range" in timeRange
              ? timeRange.range
              : DASHBOARD_AGGREGATION_PLACEHOLDER) as DashboardDateRangeOptions
          }
          setDateRangeAndOption={(option, date) =>
            setTimeRange(
              option !== DASHBOARD_AGGREGATION_PLACEHOLDER
                ? { range: option as string }
                : date
                  ? { from: date.from, to: date.to }
                  : { range: option as string },
            )
          }
        />
      </div>

      {/* Summary tiles */}
      <OrgDashboardSummaryTiles
        summary={summary.data}
        isLoading={summary.isPending}
        usageMetrics={usageMetrics.data}
        isUsageLoading={usageMetrics.isPending}
      />

      {/* Project + Model breakdown tables */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <OrgDashboardProjectBreakdownTable
          data={projectBreakdown.data}
          isLoading={projectBreakdown.isPending}
        />
        <OrgDashboardModelBreakdownTable
          data={modelBreakdown.data}
          isLoading={modelBreakdown.isPending}
        />
      </div>

      {/* Top users chart */}
      <div className="mt-4">
        <OrgDashboardTopUsersChart
          data={topUsers.data}
          isLoading={topUsers.isPending}
        />
      </div>

      {/* Org cards list */}
      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Organizations
        </h2>
        {orgsQuery.isPending ? (
          <NoDataOrLoading isLoading={true} />
        ) : filteredOrgs.length === 0 ? (
          <NoDataOrLoading isLoading={false} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredOrgs.map((org) => (
              <OrgDashboardOrgCard key={org.id} org={org} />
            ))}
          </div>
        )}
      </div>
    </ContainerPage>
  );
}

