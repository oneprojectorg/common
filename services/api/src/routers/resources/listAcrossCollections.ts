import { Channels, listResourcesAcrossCollections } from '@op/common';
import { z } from 'zod';

import { resourceInCollectionEncoder } from '../../encoders/resources';
import { openProcedure, router } from '../../trpcFactory';

const inputSchema = z.object({
  profileId: z.string().uuid(),
});

// Flattened across collections, so no top-level collectionId/cursor — each
// item carries its own collectionId (see resourceInCollectionEncoder).
const resourcesAcrossCollectionsEncoder = z.object({
  items: z.array(resourceInCollectionEncoder),
});

export const listAcrossCollections = router({
  listAcrossCollections: openProcedure()
    .input(inputSchema)
    .output(resourcesAcrossCollectionsEncoder)
    .query(async ({ input, ctx }) => {
      const result = await listResourcesAcrossCollections({
        ...input,
        user: ctx.user,
      });
      // Resource mutations broadcast profileResources:<profileId> for every
      // profile sharing the collection; collection-level mutations broadcast
      // profileCollections. Registering both keeps the flattened list live.
      ctx.registerQueryChannels([
        Channels.profileResources(input.profileId),
        Channels.profileCollections(input.profileId),
      ]);
      return resourcesAcrossCollectionsEncoder.parse(result);
    }),
});
