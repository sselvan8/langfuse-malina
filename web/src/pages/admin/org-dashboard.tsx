import { useSession } from "next-auth/react";
import { useState, useMemo } from "react";
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

export default function OrgDashboardPage() {
  const { data: session, status } = useSession();
  const [selectedOrgId, setSelectedOrgId] = useState<string>("all");

  const hasAccess = Boolean(session?.user?.canViewOrgDashboard);

  const summary = api.orgDashboard.summary.useQuery(undefined, {
    enabled: hasAccess,
  });

  const orgsQuery = api.orgDashboard.orgList.useQuery(undefined, {
    enabled: hasAccess,
  });

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
            "Cross-organization overview showing all organizations, their projects, and member counts.",
        },
      }}
    >
      <OrgDashboardSummaryTiles
        summary={summary.data}
        isLoading={summary.isPending}
      />

      <div className="mt-6 flex items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">
          Filter by Organization:
        </span>
        <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="All Organizations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Organizations</SelectItem>
            {orgsQuery.data?.map((org) => (
              <SelectItem key={org.id} value={org.id}>
                {org.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-4">
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
