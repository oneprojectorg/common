import {
  UnauthorizedError,
  getIndividualTerms,
  getIndividualTermsByProfile,
} from '@op/common';
import { TRPCError } from '@trpc/server';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import { individualsTermsEncoder } from '../../encoders/individuals';
import withAnalytics from '../../middlewares/withAnalytics';
import withAuthenticated from '../../middlewares/withAuthenticated';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'GET',
    path: '/individual/{id}/terms',
    protect: true,
    tags: ['individual'],
    summary: 'Get individual terms',
  },
};

export const getIndividualRouter = router({
  getTerms: loggedProcedure
    // Middlewares
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    .use(withAnalytics)
    // Router
    .meta(meta)
    .input(z.object({ id: z.string(), termUri: z.string().optional() }))
    .output(individualsTermsEncoder)
    .query(async ({ input }) => {
      const { id } = input;

      try {
        const result = await getIndividualTerms({
          individualId: id,
        });

        if (!result) {
          throw new TRPCError({
            message: 'Individual terms not found',
            code: 'NOT_FOUND',
          });
        }

        return individualsTermsEncoder.parse(result);
      } catch (error: unknown) {
        console.log(error);
        if (error instanceof UnauthorizedError) {
          throw new TRPCError({
            message: 'You do not have access to this individual',
            code: 'UNAUTHORIZED',
          });
        }

        throw new TRPCError({
          message: 'Individual terms not found',
          code: 'NOT_FOUND',
        });
      }
    }),
  getTermsByProfile: loggedProcedure
    // Middlewares
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    .use(withAnalytics)
    // Router
    .input(z.object({ profileId: z.string(), termUri: z.string().optional() }))
    .output(individualsTermsEncoder)
    .query(async ({ input }) => {
      const { profileId } = input;

      try {
        const result = await getIndividualTermsByProfile({
          profileId,
        });

        return individualsTermsEncoder.parse(result);
      } catch (error: unknown) {
        console.log(error);
        if (error instanceof UnauthorizedError) {
          throw new TRPCError({
            message: 'You do not have access to this profile',
            code: 'UNAUTHORIZED',
          });
        }

        throw new TRPCError({
          message: 'Individual terms not found',
          code: 'NOT_FOUND',
        });
      }
    }),
});
