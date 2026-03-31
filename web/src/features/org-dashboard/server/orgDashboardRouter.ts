import {
  createTRPCRouter,
  authenticatedProcedure,
} from "@/src/server/api/trpc";
import { TRPCError } from "@trpc/server";

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
});
