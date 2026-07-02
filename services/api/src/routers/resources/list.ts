import { Channels, listResources } from '@op/common';
import { z } from 'zod';

import { profileResourceListEncoder } from '../../encoders/resources';
import { openProcedure, router } from '../../trpcFactory';

const inputSchema = z.object({
  profileId: z.string().uuid(),
});

export const list = router({
  // openProcedure (not networkAuthenticated): the decision overview reads this
  // anonymously; the service fail-closes on a decisions READ grant, same as
  // collections.list / listByCollection.
  list: openProcedure()
    .input(inputSchema)
    .output(profileResourceListEncoder)
    .query(async ({ input, ctx }) => {
      const result = await listResources({
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
      return profileResourceListEncoder.parse(result);
    }),
});
