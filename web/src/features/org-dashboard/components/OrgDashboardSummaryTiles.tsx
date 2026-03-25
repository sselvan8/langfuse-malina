import { Building2, FolderOpen, Users } from "lucide-react";
import { type LucideIcon } from "lucide-react";

type Summary =
  | { totalOrgs: number; totalProjects: number; totalMembers: number }
  | undefined;

function SummaryTile({
  name,
  value,
  icon: Icon,
  isLoading,
}: {
  name: string;
  value: number | undefined;
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
            {isLoading ? "—" : (value?.toLocaleString() ?? "0")}
          </dd>
        </div>
      </div>
    </div>
  );
}

export function OrgDashboardSummaryTiles({
  summary,
  isLoading,
}: {
  summary: Summary;
  isLoading: boolean;
}) {
  return (
    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <SummaryTile
        name="Organizations"
        value={summary?.totalOrgs}
        icon={Building2}
        isLoading={isLoading}
      />
      <SummaryTile
        name="Projects"
        value={summary?.totalProjects}
        icon={FolderOpen}
        isLoading={isLoading}
      />
      <SummaryTile
        name="Members"
        value={summary?.totalMembers}
        icon={Users}
        isLoading={isLoading}
      />
    </dl>
  );
}
