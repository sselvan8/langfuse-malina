import {
  createTRPCRouter,
  authenticatedProcedure,
} from "@/src/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getGenerationLikeTypes } from "@langfuse/shared";
import { prisma as _prisma } from "@langfuse/shared/src/db";
import { executeQuery } from "@/src/features/query/server/queryExecutor";
import { type QueryType } from "@/src/features/query/types";

const orgUsageInput = z.object({
  orgId: z.string(), // "all" or a specific org id
  fromTimestamp: z.string().datetime(),
  toTimestamp: z.string().datetime(),
});

/** Resolve project IDs for an org (or all projects when orgId === "all").
 *  If `allowedOrgIds` is provided, restricts the "all" case to those orgs only. */
async function resolveProjectIds(
  prisma: typeof _prisma,
  orgId: string,
  allowedOrgIds?: string[],
): Promise<string[]> {
  const orgFilter =
    orgId !== "all"
      ? { orgId }
      : allowedOrgIds
        ? { orgId: { in: allowedOrgIds } }
        : {};
  const projects = await prisma.project.findMany({
    where: { deletedAt: null, ...orgFilter },
    select: { id: true },
  });
  return projects.map((p) => p.id);
}

/**
 * For non-admin users, returns the list of org IDs they own.
 * Throws FORBIDDEN if they have no owned orgs.
 * For global admins, returns null (no restriction).
 */
function getOwnedOrgIds(user: {
  isOrgDashboardAdmin: boolean;
  organizations: { id: string; role: string }[];
}): string[] | null {
  if (user.isOrgDashboardAdmin) return null;
  const ownedOrgIds = user.organizations
    .filter((o) => o.role === "OWNER")
    .map((o) => o.id);
  return ownedOrgIds;
}

/**
 * Validates that a requested orgId is accessible to the user.
 * Throws FORBIDDEN if the user (non-admin) requests an org they don't own.
 */
function assertOrgAccess(
  orgId: string,
  ownedOrgIds: string[] | null,
): void {
  if (ownedOrgIds === null) return; // global admin, no restriction
  if (orgId !== "all" && !ownedOrgIds.includes(orgId))
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You are not authorized to access this organization.",
    });
}

export const orgDashboardRouter = createTRPCRouter({
  summary: authenticatedProcedure.query(async ({ ctx }) => {
    if (!ctx.session.user.canViewOrgDashboard)
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Your account is not authorized to access the org dashboard.",
      });

    const isGlobalAdmin = ctx.session.user.isOrgDashboardAdmin;

    if (isGlobalAdmin) {
      const [totalOrgs, totalProjects, totalMembers] = await Promise.all([
        ctx.prisma.organization.count(),
        ctx.prisma.project.count({ where: { deletedAt: null } }),
        ctx.prisma.organizationMembership.count(),
      ]);
      return { totalOrgs, totalProjects, totalMembers };
    }

    // Org owner: scope to owned orgs only
    const ownedOrgIds = ctx.session.user.organizations
      .filter((o) => o.role === "OWNER")
      .map((o) => o.id);
    if (ownedOrgIds.length === 0)
      throw new TRPCError({ code: "FORBIDDEN" });

    const [totalProjects, totalMembers] = await Promise.all([
      ctx.prisma.project.count({
        where: { deletedAt: null, orgId: { in: ownedOrgIds } },
      }),
      ctx.prisma.organizationMembership.count({
        where: { orgId: { in: ownedOrgIds } },
      }),
    ]);
    return {
      totalOrgs: ownedOrgIds.length,
      totalProjects,
      totalMembers,
    };
  }),

  orgList: authenticatedProcedure.query(async ({ ctx }) => {
    if (!ctx.session.user.canViewOrgDashboard)
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Your account is not authorized to access the org dashboard.",
      });

    const isGlobalAdmin = ctx.session.user.isOrgDashboardAdmin;
    const ownedOrgIds = isGlobalAdmin
      ? null
      : ctx.session.user.organizations
          .filter((o) => o.role === "OWNER")
          .map((o) => o.id);

    if (!isGlobalAdmin && (!ownedOrgIds || ownedOrgIds.length === 0))
      throw new TRPCError({ code: "FORBIDDEN" });

    const orgs = await ctx.prisma.organization.findMany({
      where: ownedOrgIds ? { id: { in: ownedOrgIds } } : {},
      include: {
        _count: {
          select: {
            projects: { where: { deletedAt: null } },
            organizationMemberships: true,
          },
        },
        projects: {
          where: { deletedAt: null },
          select: { id: true, name: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return orgs.map((org) => ({
      id: org.id,
      name: org.name,
      createdAt: org.createdAt,
      projectCount: org._count.projects,
      memberCount: org._count.organizationMemberships,
      projects: org.projects,
    }));
  }),

  /** Scalar rollup: total traces, tokens, cost, and distinct model count */
  orgUsageMetrics: authenticatedProcedure
    .input(orgUsageInput)
    .query(async ({ ctx, input }) => {
      if (!ctx.session.user.canViewOrgDashboard)
        throw new TRPCError({ code: "FORBIDDEN" });

      const ownedOrgIds = getOwnedOrgIds(ctx.session.user);
      assertOrgAccess(input.orgId, ownedOrgIds);

      const projectIds = await resolveProjectIds(
        ctx.prisma,
        input.orgId,
        ownedOrgIds ?? undefined,
      );
      if (projectIds.length === 0)
        return { totalTraces: 0, totalTokens: 0, totalCost: 0, uniqueModels: 0 };

      const [tracesResult, obsResult] = await Promise.all([
        executeQuery(projectIds, {
          view: "traces",
          dimensions: [],
          metrics: [
            { measure: "count", aggregation: "count" },
            { measure: "totalTokens", aggregation: "sum" },
            { measure: "totalCost", aggregation: "sum" },
          ],
          filters: [],
          timeDimension: null,
          fromTimestamp: input.fromTimestamp,
          toTimestamp: input.toTimestamp,
          orderBy: null,
          chartConfig: { type: "table" },
        } satisfies QueryType),
        executeQuery(projectIds, {
          view: "observations",
          dimensions: [{ field: "providedModelName" }],
          metrics: [{ measure: "count", aggregation: "count" }],
          filters: [
            {
              column: "type",
              operator: "any of",
              value: getGenerationLikeTypes(),
              type: "stringOptions",
            },
          ],
          timeDimension: null,
          fromTimestamp: input.fromTimestamp,
          toTimestamp: input.toTimestamp,
          orderBy: null,
          chartConfig: { type: "table" },
        } satisfies QueryType),
      ]);

      const row = tracesResult[0] ?? {};
      return {
        totalTraces: Number(row.count_count ?? 0),
        totalTokens: Number(row.sum_totalTokens ?? 0),
        totalCost: Number(row.sum_totalCost ?? 0),
        uniqueModels: obsResult.filter(
          (r) => r.providedModelName != null && r.providedModelName !== "",
        ).length,
      };
    }),

  /** Per-project breakdown: traces, tokens, cost */
  projectBreakdown: authenticatedProcedure
    .input(orgUsageInput)
    .query(async ({ ctx, input }) => {
      if (!ctx.session.user.canViewOrgDashboard)
        throw new TRPCError({ code: "FORBIDDEN" });

      const ownedOrgIds = getOwnedOrgIds(ctx.session.user);
      assertOrgAccess(input.orgId, ownedOrgIds);

      const orgFilter =
        input.orgId !== "all"
          ? { orgId: input.orgId }
          : ownedOrgIds
            ? { orgId: { in: ownedOrgIds } }
            : {};

      const projects = await ctx.prisma.project.findMany({
        where: { deletedAt: null, ...orgFilter },
        select: { id: true, name: true },
      });

      if (projects.length === 0) return [];

      const projectIds = projects.map((p) => p.id);
      const projectNameById = Object.fromEntries(
        projects.map((p) => [p.id, p.name]),
      );

      // Run one scalar query per project in parallel for traces/tokens/cost
      const perProjectRows = await Promise.all(
        projectIds.map(async (pid) => {
          const result = await executeQuery(pid, {
            view: "traces",
            dimensions: [],
            metrics: [
              { measure: "count", aggregation: "count" },
              { measure: "totalTokens", aggregation: "sum" },
              { measure: "totalCost", aggregation: "sum" },
            ],
            filters: [],
            timeDimension: null,
            fromTimestamp: input.fromTimestamp,
            toTimestamp: input.toTimestamp,
            orderBy: null,
            chartConfig: { type: "table" },
          } satisfies QueryType);
          const r = result[0] ?? {};
          return {
            projectId: pid,
            projectName: projectNameById[pid] ?? pid,
            traceCount: Number(r.count_count ?? 0),
            totalTokens: Number(r.sum_totalTokens ?? 0),
            totalCost: Number(r.sum_totalCost ?? 0),
          };
        }),
      );

      return perProjectRows
        .filter((r) => r.traceCount > 0 || r.totalCost > 0)
        .sort((a, b) => b.totalCost - a.totalCost);
    }),

  /** Model-level breakdown: tokens + cost across the org */
  modelBreakdown: authenticatedProcedure
    .input(orgUsageInput)
    .query(async ({ ctx, input }) => {
      if (!ctx.session.user.canViewOrgDashboard)
        throw new TRPCError({ code: "FORBIDDEN" });

      const ownedOrgIds = getOwnedOrgIds(ctx.session.user);
      assertOrgAccess(input.orgId, ownedOrgIds);

      const projectIds = await resolveProjectIds(
        ctx.prisma,
        input.orgId,
        ownedOrgIds ?? undefined,
      );
      if (projectIds.length === 0) return [];

      const rows = await executeQuery(projectIds, {
        view: "observations",
        dimensions: [{ field: "providedModelName" }],
        metrics: [
          { measure: "totalTokens", aggregation: "sum" },
          { measure: "totalCost", aggregation: "sum" },
        ],
        filters: [
          {
            column: "type",
            operator: "any of",
            value: getGenerationLikeTypes(),
            type: "stringOptions",
          },
        ],
        timeDimension: null,
        fromTimestamp: input.fromTimestamp,
        toTimestamp: input.toTimestamp,
        orderBy: [{ field: "sum_totalCost", direction: "desc" }],
        chartConfig: { type: "table", row_limit: 50 },
      } satisfies QueryType);

      return rows
        .filter((r) => r.providedModelName != null && r.providedModelName !== "")
        .map((r) => ({
          model: r.providedModelName as string,
          totalTokens: Number(r.sum_totalTokens ?? 0),
          totalCost: Number(r.sum_totalCost ?? 0),
        }));
    }),

  /** Top 10 users by token cost across the org */
  topUsers: authenticatedProcedure
    .input(orgUsageInput)
    .query(async ({ ctx, input }) => {
      if (!ctx.session.user.canViewOrgDashboard)
        throw new TRPCError({ code: "FORBIDDEN" });

      const ownedOrgIds = getOwnedOrgIds(ctx.session.user);
      assertOrgAccess(input.orgId, ownedOrgIds);

      const projectIds = await resolveProjectIds(
        ctx.prisma,
        input.orgId,
        ownedOrgIds ?? undefined,
      );
      if (projectIds.length === 0) return [];

      const [costRows, traceRows] = await Promise.all([
        executeQuery(projectIds, {
          view: "observations",
          dimensions: [{ field: "userId" }],
          metrics: [
            { measure: "totalCost", aggregation: "sum" },
            { measure: "totalTokens", aggregation: "sum" },
          ],
          filters: [
            {
              column: "type",
              operator: "any of",
              value: getGenerationLikeTypes(),
              type: "stringOptions",
            },
          ],
          timeDimension: null,
          fromTimestamp: input.fromTimestamp,
          toTimestamp: input.toTimestamp,
          orderBy: [{ field: "sum_totalCost", direction: "desc" }],
          chartConfig: { type: "HORIZONTAL_BAR", row_limit: 10 },
        } satisfies QueryType),
        executeQuery(projectIds, {
          view: "traces",
          dimensions: [{ field: "userId" }],
          metrics: [{ measure: "count", aggregation: "count" }],
          filters: [],
          timeDimension: null,
          fromTimestamp: input.fromTimestamp,
          toTimestamp: input.toTimestamp,
          orderBy: [{ field: "count_count", direction: "desc" }],
          chartConfig: { type: "HORIZONTAL_BAR", row_limit: 10 },
        } satisfies QueryType),
      ]);

      const costByUser = Object.fromEntries(
        costRows.map((r) => [
          r.userId as string,
          {
            totalCost: Number(r.sum_totalCost ?? 0),
            totalTokens: Number(r.sum_totalTokens ?? 0),
          },
        ]),
      );
      const tracesByUser = Object.fromEntries(
        traceRows.map((r) => [
          r.userId as string,
          Number(r.count_count ?? 0),
        ]),
      );

      const users = new Set([
        ...Object.keys(costByUser),
        ...Object.keys(tracesByUser),
      ]);

      return [...users]
        .filter((u) => u != null && u !== "")
        .map((userId) => ({
          userId,
          totalCost: costByUser[userId]?.totalCost ?? 0,
          totalTokens: costByUser[userId]?.totalTokens ?? 0,
          traceCount: tracesByUser[userId] ?? 0,
        }))
        .sort((a, b) => b.totalCost - a.totalCost)
        .slice(0, 10);
    }),
});

