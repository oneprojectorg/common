import { cache } from '@op/cache';
import {
  UnauthorizedError,
  getOrganization,
  getOrganizationTerms,
} from '@op/common';
import { TRPCError } from '@trpc/server';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import {
  organizationsTermsEncoder,
  organizationsWithProfileEncoder,
} from '../../encoders/organizations';
import withAnalytics from '../../middlewares/withAnalytics';
import withAuthenticated from '../../middlewares/withAuthenticated';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

const inputSchema = z.object({
  slug: z.string(),
});

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'GET',
    path: '/organization/{slug}',
    protect: true,
    tags: ['organization'],
    summary: 'Get organization',
  },
};

export const getOrganizationRouter = router({
  getBySlug: loggedProcedure
    // Middlewares
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    .use(withAnalytics)
    // Router
    .meta(meta)
    .input(inputSchema)
    .output(organizationsWithProfileEncoder)
    .query(async ({ ctx, input }) => {
      const { slug } = input;
      const { user } = ctx;

      try {
        const result = await cache({
          type: 'organization',
          params: [slug],
          fetch: () => getOrganization({ slug, user }),
        });

        if (!result) {
          throw new TRPCError({
            message: 'Organization not found',
            code: 'NOT_FOUND',
          });
        }

        // Transform profile modules to simplified format
        const transformedResult = {
          ...result,
          profile: {
            ...result.profile,
            modules: result.profile.modules?.map((profileModule: any) => ({
              slug: profileModule.module.slug,
            })),
          },
        };

        return organizationsWithProfileEncoder.parse(transformedResult);
      } catch (error: unknown) {
        console.log(error);
        if (error instanceof UnauthorizedError) {
          throw new TRPCError({
            message: 'You do not have acess to this organization',
            code: 'UNAUTHORIZED',
          });
        }

        throw new TRPCError({
          message: 'Organization not found',
          code: 'NOT_FOUND',
        });
      }
    }),
  getTerms: loggedProcedure
    // Middlewares
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    .use(withAnalytics)
    // Router
    // .meta(meta)
    .input(z.object({ id: z.string(), termUri: z.string().optional() }))
    .output(organizationsTermsEncoder)
    .query(async ({ ctx, input }) => {
      const { id } = input;
      const { user } = ctx;

      try {
        const result = await getOrganizationTerms({
          organizationId: id,
          user,
        });

        if (!result) {
          throw new TRPCError({
            message: 'Organization terms not found',
            code: 'NOT_FOUND',
          });
        }

        return organizationsTermsEncoder.parse(result);
      } catch (error: unknown) {
        console.log(error);
        if (error instanceof UnauthorizedError) {
          throw new TRPCError({
            message: 'You do not have acess to this organization',
            code: 'UNAUTHORIZED',
          });
        }

        throw new TRPCError({
          message: 'Organization terms not found',
          code: 'NOT_FOUND',
        });
      }
    }),
});
