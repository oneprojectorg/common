import {
  Channels,
  deleteResource,
  getScopesForResource,
  invalidateProfileResources,
} from '@op/common';
import { z } from 'zod';

import { networkAuthenticatedProcedure, router } from '../../trpcFactory';

export const deleteResourceRouter = router({
  delete: networkAuthenticatedProcedure()
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      // Resolve scopes BEFORE delete - after delete the resource has no rows.
      const scopes = await getScopesForResource(input.id);
      await deleteResource({
        authUserId: ctx.user.id,
        id: input.id,
      });
      await invalidateProfileResources(scopes.profileIds);
      ctx.registerMutationChannels([
        ...scopes.collectionIds.map((id) => Channels.collectionResources(id)),
        ...scopes.profileIds.map((id) => Channels.profileResources(id)),
      ]);
    }),
});
