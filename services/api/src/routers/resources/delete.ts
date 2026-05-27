import { Channels, deleteResource, getScopesForResource } from '@op/common';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';

export const deleteResourceRouter = router({
  delete: commonAuthedProcedure()
    .input(z.object({ id: z.string().uuid() }))
    .output(z.object({ ok: z.literal(true) }))
    .mutation(async ({ input, ctx }) => {
      // Resolve scopes BEFORE delete - after delete the resource has no rows.
      const scopes = await getScopesForResource(input.id);
      const result = await deleteResource({
        authUserId: ctx.user.id,
        id: input.id,
      });
      ctx.registerMutationChannels([
        ...scopes.collectionIds.map((id) => Channels.collectionResources(id)),
        ...scopes.profileIds.map((id) => Channels.profileResources(id)),
      ]);
      return result;
    }),
});
