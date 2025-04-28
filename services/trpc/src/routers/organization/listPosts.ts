import { TRPCError } from '@trpc/server';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import { postsEncoder } from '../../encoders/posts';
import withAuthenticated from '../../middlewares/withAuthenticated';
import withDB from '../../middlewares/withDB';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

const inputSchema = z.object({
  slug: z.string(),
});
const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'GET',
    path: '/organization/{slug}/feed/posts',
    protect: true,
    tags: ['organization'],
    summary: 'List posts for an organization',
  },
};

export const listOrganizationPostsRouter = router({
  listPosts: loggedProcedure
    // Middlewares
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    .use(withDB)
    // Router
    .meta(meta)
    .input(inputSchema)
    .output(z.array(postsEncoder))
    .query(async ({ ctx, input }) => {
      const { db } = ctx.database;
      const { slug } = input;

      const org = await db.query.organizations.findFirst({
        where: (table, { eq }) => eq(table.slug, slug),
      });

      if (!org) {
        throw new TRPCError({
          message: 'Organization not found',
          code: 'NOT_FOUND',
        });
      }

      const result = await db.query.postsToOrganizations.findMany({
        where: (table, { eq }) => eq(table.organizationId, org.id),
        with: {
          post: true,
        },
      });

      // TODO: fixing for demo but should be at the DB level
      const sorted = result
        .map((res) => res.post)
        .sort(
          (a, b) =>
            new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime(),
        );

      return sorted;
    }),
});
