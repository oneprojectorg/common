import {
  Channels,
  getScopesForResource,
  httpUrlSchema,
  updateResource,
} from '@op/common';
import { z } from 'zod';

import withDB from '../../middlewares/withDB';
import { commonAuthedProcedure, router } from '../../trpcFactory';
import { resourceWithSignedUrlEncoder } from './encoders';

const patchSchema = z
  .object({
    title: z.string().trim().min(1).max(50).optional(),
    description: z.string().max(250).nullable().optional(),
    linkUrl: httpUrlSchema.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'At least one field must be provided',
  });

export const update = router({
  update: commonAuthedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 20 },
  })
    .use(withDB)
    .input(z.object({ id: z.string().uuid(), patch: patchSchema }))
    .output(resourceWithSignedUrlEncoder)
    .mutation(async ({ input, ctx }) => {
      const row = await updateResource({
        authUserId: ctx.user.id,
        id: input.id,
        patch: input.patch,
      });
      const scopes = await getScopesForResource(input.id);
      ctx.registerMutationChannels([
        ...scopes.collectionIds.map((id) => Channels.collectionResources(id)),
        ...scopes.profileIds.map((id) => Channels.profileResources(id)),
      ]);
      return resourceWithSignedUrlEncoder.parse(row);
    }),
});
