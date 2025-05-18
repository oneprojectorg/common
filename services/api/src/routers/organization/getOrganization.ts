import {
  UnauthorizedError,
  getOrganization,
  getOrganizationTerms,
} from '@op/common';
import { TRPCError } from '@trpc/server';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import {
  organizationsEncoder,
  organizationsTermsEncoder,
} from '../../encoders/organizations';
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
    .use(withDB)
    // Router
    .meta(meta)
    .input(inputSchema)
    .output(organizationsEncoder)
    .query(async ({ ctx, input }) => {
      const { slug } = input;
      const { user } = ctx;

      try {
        const result = await getOrganization({ slug, user });

        if (!result) {
          throw new TRPCError({
            message: 'Organization not found',
            code: 'NOT_FOUND',
          });
        }

        return organizationsEncoder.parse(result);
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
  getById: loggedProcedure
    // Middlewares
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    .use(withDB)
    // Router
    // .meta(meta)
    .input(z.object({ id: z.string() }))
    .output(organizationsEncoder)
    .query(async ({ ctx, input }) => {
      const { id } = input;
      const { user } = ctx;

      try {
        const result = await getOrganization({ id, user });

        if (!result) {
          throw new TRPCError({
            message: 'Organization not found',
            code: 'NOT_FOUND',
          });
        }

        return organizationsEncoder.parse(result);
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
    .use(withDB)
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
