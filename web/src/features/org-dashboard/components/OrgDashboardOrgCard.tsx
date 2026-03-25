import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import {
  ChevronDown,
  ChevronUp,
  FolderOpen,
  Users,
  Calendar,
} from "lucide-react";
import Link from "next/link";
import { LocalIsoDate } from "@/src/components/LocalIsoDate";

export type OrgData = {
  id: string;
  name: string;
  createdAt: Date;
  projectCount: number;
  memberCount: number;
  projects: { id: string; name: string; createdAt: Date }[];
};

export function OrgDashboardOrgCard({ org }: { org: OrgData }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="truncate text-base">{org.name}</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 shrink-0 p-0"
            onClick={() => setExpanded(!expanded)}
            title={expanded ? "Collapse projects" : "Show projects"}
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <FolderOpen className="h-3.5 w-3.5" />
            {org.projectCount} project{org.projectCount !== 1 ? "s" : ""}
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {org.memberCount} member{org.memberCount !== 1 ? "s" : ""}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            <LocalIsoDate date={org.createdAt} />
          </span>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent className="pt-0">
          <div className="border-t pt-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Projects
            </p>
            {org.projects.length === 0 ? (
              <p className="text-sm text-muted-foreground">No projects yet</p>
            ) : (
              <div className="flex flex-col gap-1">
                {org.projects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/project/${project.id}`}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                  >
                    <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{project.name}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
