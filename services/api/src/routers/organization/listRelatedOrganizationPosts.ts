import { getRelatedOrganizations } from '@op/common';
import { inArray } from '@op/db/client';
import { postsToOrganizations } from '@op/db/schema';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import { organizationsEncoder } from '../../encoders';
import {
  postsEncoder,
  postsToOrganizationsEncoder,
} from '../../encoders/posts';
import withAuthenticated from '../../middlewares/withAuthenticated';
import withDB from '../../middlewares/withDB';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

const inputSchema = z.object({
  organizationId: z.string().uuid({ message: 'Invalid organization ID' }),
});

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'GET',
    path: '/organization/{organizationId}/feed',
    protect: true,
    tags: ['organization', 'posts', 'relationships'],
    summary: 'List posts for organizations related to a given organization',
  },
};

export const listRelatedOrganizationPostsRouter = router({
  listRelatedPosts: loggedProcedure
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    .use(withDB)
    .meta(meta)
    .input(inputSchema)
    .output(z.array(postsToOrganizationsEncoder))
    .query(async ({ ctx, input }) => {
      const { db } = ctx.database;
      const { organizationId } = input;
      const { user } = ctx;

      // Get related organizations
      const { records: organizations } = await getRelatedOrganizations({
        user,
        orgId: organizationId,
        pending: false,
      });

      const orgIds = organizations?.map((org: any) => org.id) ?? [];
      orgIds.push(organizationId); // Add our own org so we see our own posts

      // Fetch posts for all related organizations
      const result = await db.query.postsToOrganizations.findMany({
        where: () => inArray(postsToOrganizations.organizationId, orgIds),
        with: {
          post: true,
          organization: {
            with: {
              avatarImage: true,
            },
          },
        },
        orderBy: (table, { desc }) => desc(table.createdAt),
      });

      return result.map((postToOrg) => ({
        ...postToOrg,
        organization: organizationsEncoder.parse(postToOrg.organization),
        post: postsEncoder.parse(postToOrg.post),
      }));
    }),
});
