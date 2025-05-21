import {
  UnauthorizedError,
  createOrganization,
  geoNamesDataSchema,
} from '@op/common';
import { TRPCError } from '@trpc/server';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import { organizationsEncoder } from '../../encoders/organizations';
import withAuthenticated from '../../middlewares/withAuthenticated';
import withDB from '../../middlewares/withDB';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';

const multiSelectOptionValidator = z.object({
  id: z.string(),
  label: z.string().max(200),
  isNewValue: z.boolean().default(false).optional(),
  data: z.any().optional(),
});

const inputSchema = z.object({
  name: z
    .string()
    .min(1, { message: 'Enter a name for your organization' })
    .max(200, { message: 'Must be at most 200 characters' })
    .optional(),
  website: z
    .string()
    .min(1, { message: 'enter a ' })
    .max(200, { message: 'Must be at most 200 characters' }),
  email: z
    .string()
    .email({ message: 'Invalid email' })
    .max(200, { message: 'Must be at most 200 characters' })
    .optional(),
  orgType: z.string().max(200, { message: 'Must be at most 20 characters' }),
  bio: z.string().max(200, { message: 'Must be at most 200 characters' }),
  mission: z
    .string()
    .max(200, { message: 'Must be at most 200 characters' })
    .optional(),
  whereWeWork: z
    .array(
      multiSelectOptionValidator.extend({
        data: geoNamesDataSchema.optional(),
      }),
    )
    .optional(),
  focusAreas: z.array(multiSelectOptionValidator).optional(),
  communitiesServed: z.array(multiSelectOptionValidator).optional(),
  strategies: z.array(multiSelectOptionValidator).optional(),
  networkOrganization: z.boolean().default(false),

  isReceivingFunds: z.boolean().default(false).optional(),
  isOfferingFunds: z.boolean().default(false).optional(),
  acceptingApplications: z.boolean().default(false).optional(),
  receivingFundsDescription: z.string().optional(),
  receivingFundsLink: z.string().optional(),
  offeringFundsDescription: z.string().optional(),
  offeringFundsLink: z.string().optional(),

  orgAvatarImageId: z.string().optional(),
  orgBannerImageId: z.string().optional(),
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
        const org = await createOrganization({ data: input, user });

        return organizationsEncoder.parse(org);
      } catch (error: unknown) {
        console.log('ERROR', error);

        if (error instanceof UnauthorizedError) {
          throw new TRPCError({
            message: 'You do not have permission to create organizations',
            code: 'UNAUTHORIZED',
          });
        }

        throw new TRPCError({
          message: 'Failed to create organization',
          code: 'INTERNAL_SERVER_ERROR',
        });
      }
    }),
});
