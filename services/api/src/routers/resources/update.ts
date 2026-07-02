import {
  Channels,
  RESOURCE_DESCRIPTION_MAX_LEN,
  RESOURCE_TITLE_MAX_LEN,
  getScopesForResource,
  httpUrlSchema,
  invalidateProfileResources,
  updateResource,
} from '@op/common';
import { z } from 'zod';

import { resourceWithSignedUrlEncoder } from '../../encoders/resources';
import { networkAuthenticatedProcedure, router } from '../../trpcFactory';

const dataSchema = z
  .object({
    title: z.string().trim().min(1).max(RESOURCE_TITLE_MAX_LEN).optional(),
    description: z
      .string()
      .max(RESOURCE_DESCRIPTION_MAX_LEN)
      .nullable()
      .optional(),
    linkUrl: httpUrlSchema.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'At least one field must be provided',
  });

export const update = router({
  update: networkAuthenticatedProcedure()
    .input(z.object({ id: z.string().uuid(), data: dataSchema }))
    .output(resourceWithSignedUrlEncoder)
    .mutation(async ({ input, ctx }) => {
      const row = await updateResource({
        authUserId: ctx.user.id,
        id: input.id,
        data: input.data,
      });
      const scopes = await getScopesForResource(input.id);
      await invalidateProfileResources(scopes.profileIds);
      ctx.registerMutationChannels([
        ...scopes.collectionIds.map((id) => Channels.collectionResources(id)),
        ...scopes.profileIds.map((id) => Channels.profileResources(id)),
      ]);
      return resourceWithSignedUrlEncoder.parse(row);
    }),
});
