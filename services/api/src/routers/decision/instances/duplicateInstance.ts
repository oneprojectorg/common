import {
  assertUserByAuthId,
  duplicateInstance,
  getProfileAccessUser,
  CommonError,
  UnauthorizedError,
} from '@op/common';
import { db } from '@op/db/client';
import { assertAccess, permission } from 'access-zones';
import { z } from 'zod';

import { decisionProfileWithSchemaEncoder } from '../../../encoders/decision';
import { commonAuthedProcedure, router } from '../../../trpcFactory';

const duplicateInstanceInputSchema = z.object({
  instanceId: z.string().uuid(),
  name: z.string().min(1),
  stewardProfileId: z.string().uuid().optional(),
  include: z.object({
    processSettings: z.boolean(),
    phases: z.boolean(),
    proposalCategories: z.boolean(),
    proposalTemplate: z.boolean(),
    reviewSettings: z.boolean(),
    reviewRubric: z.boolean(),
    roles: z.boolean(),
  }),
});

export const duplicateInstanceRouter = router({
  duplicateInstance: commonAuthedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 5 },
  })
    .input(duplicateInstanceInputSchema)
    .output(decisionProfileWithSchemaEncoder)
    .mutation(async ({ ctx, input }) => {
      const { user } = ctx;

      // Resolve the caller's DB user and owner profile
      const dbUser = await assertUserByAuthId(
        user.id,
        new UnauthorizedError('User must be authenticated'),
      );

      const ownerProfileId = dbUser.currentProfileId ?? dbUser.profileId;
      if (!ownerProfileId) {
        throw new UnauthorizedError('User must have an active profile');
      }

      if (!user.email) {
        throw new CommonError(
          'Failed to duplicate decision process instance. User email was missing',
        );
      }

      // Verify the caller has admin access on the source instance
      const sourceInstance = await db.query.processInstances.findFirst({
        where: { id: input.instanceId },
      });

      if (!sourceInstance?.profileId) {
        throw new Error('Source instance not found');
      }

      const profileUser = await getProfileAccessUser({
        user,
        profileId: sourceInstance.profileId,
      });

      assertAccess(
        [{ decisions: permission.ADMIN }],
        profileUser?.roles ?? [],
      );

      const profile = await duplicateInstance({
        instanceId: input.instanceId,
        name: input.name,
        ownerProfileId,
        stewardProfileId: input.stewardProfileId,
        creatorAuthUserId: user.id,
        creatorEmail: user.email,
        include: input.include,
      });

      return decisionProfileWithSchemaEncoder.parse(profile);
    }),
});
