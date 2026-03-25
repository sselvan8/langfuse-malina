import {
  createTRPCRouter,
  authenticatedProcedure,
} from "@/src/server/api/trpc";
import { checkCustomOrgCreatorWhitelist } from "@/src/features/organizations/server/customOrgCreationMiddleware";

export const orgDashboardRouter = createTRPCRouter({
  summary: authenticatedProcedure.query(async ({ ctx }) => {
    checkCustomOrgCreatorWhitelist(ctx.session.user.email ?? null);

    const [totalOrgs, totalProjects, totalMembers] = await Promise.all([
      ctx.prisma.organization.count(),
      ctx.prisma.project.count({ where: { deletedAt: null } }),
      ctx.prisma.organizationMembership.count(),
    ]);

    return { totalOrgs, totalProjects, totalMembers };
  }),

  orgList: authenticatedProcedure.query(async ({ ctx }) => {
    checkCustomOrgCreatorWhitelist(ctx.session.user.email ?? null);

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
