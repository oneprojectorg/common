import { TRPCError } from '@trpc/server';

import {
  createOrganization,
  createOrganizationWithUser,
  UnauthorizedError,
} from '@op/common';

import {
  organizationsCreateInputEncoder,
  organizationsEncoder,
} from '../../encoders/organizations';
import withAuthenticated from '../../middlewares/withAuthenticated';
import withDB from '../../middlewares/withDB';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

// const inputSchema = organizationsCreateInputEncoder;
const inputSchema = z.object({
  fullName: z.string(),
  title: z.string(),
  organizationName: z.string(),
  website: z.string(),
  email: z.string(),
  orgType: z.string(),
  bio: z.string(),
  mission: z.string(),
  isReceivingFunds: z.boolean(),
  isOfferingFunds: z.boolean(),
  acceptingApplications: z.boolean(),

  receivingFundsDescription: z.string().optional(),
  receivingFundsLink: z.string().optional(),
  offeringFundsDescription: z.string().optional(),
  offeringFundsLink: z.string().optional(),
});

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'POST',
    path: '/organization',
    protect: true,
    tags: ['organization'],
    summary: 'Create organization',
  },
};

export const createOrganizationRouter = router({
  create: loggedProcedure
    // Middlewares
    .use(withRateLimited({ windowSize: 10, maxRequests: 10 }))
    .use(withAuthenticated)
    .use(withDB)
    // Router
    .meta(meta)
    .input(inputSchema)
    .output(organizationsEncoder)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;

      try {
        const org = await createOrganizationWithUser({ data: input, user });

        return org;
      } catch (error: unknown) {
        if (error instanceof UnauthorizedError) {
          throw new TRPCError({
            message: 'You do not have permission to create organizations',
            code: 'UNAUTHORIZED',
          });
        }

        console.log('ERROR', error.message);
        throw new TRPCError({
          message: 'Failed to create organization',
          code: 'INTERNAL_SERVER_ERROR',
        });
      }
    }),
});
