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

/** Resolve project IDs for an org (or all projects when orgId === "all") */
async function resolveProjectIds(
  prisma: typeof _prisma,
  orgId: string,
): Promise<string[]> {
  const projects = await prisma.project.findMany({
    where: {
      deletedAt: null,
      ...(orgId !== "all" ? { orgId } : {}),
    },
    select: { id: true },
  });
  return projects.map((p) => p.id);
}

export const orgDashboardRouter = createTRPCRouter({
  summary: authenticatedProcedure.query(async ({ ctx }) => {
    if (!ctx.session.user.canViewOrgDashboard)
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Your account is not authorized to access the org dashboard.",
      });

    const [totalOrgs, totalProjects, totalMembers] = await Promise.all([
      ctx.prisma.organization.count(),
      ctx.prisma.project.count({ where: { deletedAt: null } }),
      ctx.prisma.organizationMembership.count(),
    ]);

    return { totalOrgs, totalProjects, totalMembers };
  }),

  orgList: authenticatedProcedure.query(async ({ ctx }) => {
    if (!ctx.session.user.canViewOrgDashboard)
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Your account is not authorized to access the org dashboard.",
      });

    const orgs = await ctx.prisma.organization.findMany({
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

      const projectIds = await resolveProjectIds(ctx.prisma, input.orgId);
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

      const projects = await ctx.prisma.project.findMany({
        where: {
          deletedAt: null,
          ...(input.orgId !== "all" ? { orgId: input.orgId } : {}),
        },
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

      const projectIds = await resolveProjectIds(ctx.prisma, input.orgId);
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

      const projectIds = await resolveProjectIds(ctx.prisma, input.orgId);
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

