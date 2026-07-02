import {
  Channels,
  RESOURCE_DESCRIPTION_MAX_LEN,
  RESOURCE_TITLE_MAX_LEN,
  createLinkResource,
  getProfileIdsForCollection,
  httpUrlSchema,
  invalidateProfileResources,
} from '@op/common';
import type { ChannelName } from '@op/common/realtime';
import { z } from 'zod';

import { resourceInCollectionEncoder } from '../../encoders/resources';
import { networkAuthenticatedProcedure, router } from '../../trpcFactory';

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
  title: z.string().trim().min(1).max(RESOURCE_TITLE_MAX_LEN),
  description: z
    .string()
    .max(RESOURCE_DESCRIPTION_MAX_LEN)
    .nullable()
    .optional(),
  linkUrl: httpUrlSchema,
  // Optional drop-at-position: insert directly below this collection member
  // (null = top). Omitted by the Add Resource form, which lands at the top.
  upperNeighborId: z.string().uuid().nullable().optional(),
});

export const createLink = router({
  createLink: networkAuthenticatedProcedure()
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
        upperNeighborId: input.upperNeighborId,
      });
      const profileIds =
        target.kind === 'profile'
          ? [target.profileId]
          : await getProfileIdsForCollection(row.collectionId);
      await invalidateProfileResources(profileIds);
      const channels: ChannelName[] = [
        Channels.collectionResources(row.collectionId),
        ...profileIds.map((id) => Channels.profileResources(id)),
      ];
      // Only the profile-target path can lazy-create a default collection;
      // when callers target an existing collection there is no chance of a
      // new collection appearing, so broadcasting profileCollections is just
      // wasted invalidation.
      if (target.kind === 'profile') {
        channels.push(Channels.profileCollections(target.profileId));
      }
      ctx.registerMutationChannels(channels);
      return resourceInCollectionEncoder.parse(row);
    }),
});
