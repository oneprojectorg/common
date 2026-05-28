import {
  Channels,
  createLinkResource,
  getProfileIdsForCollection,
  httpUrlSchema,
} from '@op/common';
import { z } from 'zod';

import { resourceInCollectionEncoder } from '../../encoders/resources';
import { commonAuthedProcedure, router } from '../../trpcFactory';

const inputSchema = z.object({
  target: z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('profile'),
      profileId: z.string().uuid(),
    }),
    z.object({
      kind: z.literal('collection'),
      collectionId: z.string().uuid(),
    }),
  ]),
  title: z.string().trim().min(1).max(50),
  description: z.string().max(250).nullable().optional(),
  linkUrl: httpUrlSchema,
});

export const createLink = router({
  createLink: commonAuthedProcedure()
    .input(inputSchema)
    .output(resourceInCollectionEncoder)
    .mutation(async ({ input, ctx }) => {
      const { target } = input;
      const row = await createLinkResource({
        authUserId: ctx.user.id,
        profileId: target.kind === 'profile' ? target.profileId : undefined,
        collectionId:
          target.kind === 'collection' ? target.collectionId : undefined,
        title: input.title,
        description: input.description ?? null,
        linkUrl: input.linkUrl,
      });
      const profileIds =
        target.kind === 'profile'
          ? [target.profileId]
          : await getProfileIdsForCollection(row.collectionId);
      ctx.registerMutationChannels([
        Channels.collectionResources(row.collectionId),
        ...profileIds.map((id) => Channels.profileResources(id)),
      ]);
      return resourceInCollectionEncoder.parse(row);
    }),
});
