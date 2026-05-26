import {
  Channels,
  createCollection,
  deleteCollection,
  getProfileIdsForCollection,
  listCollections,
  renameCollection,
  reorderCollection,
} from '@op/common';
import { z } from 'zod';

import withDB from '../../middlewares/withDB';
import { commonAuthedProcedure, router } from '../../trpcFactory';
import { collectionEncoder } from './encoders';

const reorderInput = z.object({
  id: z.string().uuid(),
  upperNeighborId: z.string().uuid().nullable(),
});

const collectionChannels = (profileIds: string[], collectionId: string) => [
  ...profileIds.map((id) => Channels.profileCollections(id)),
  ...profileIds.map((id) => Channels.profileResources(id)),
  Channels.collectionResources(collectionId),
];

export const collectionsRouter = router({
  collections: router({
    list: commonAuthedProcedure()
      .use(withDB)
      .input(z.object({ profileId: z.string().uuid() }))
      .output(z.array(collectionEncoder))
      .query(async ({ input, ctx }) => {
        const rows = await listCollections(ctx.user.id, input.profileId);
        ctx.registerQueryChannels([
          Channels.profileCollections(input.profileId),
        ]);
        return rows.map((row) => collectionEncoder.parse(row));
      }),

    create: commonAuthedProcedure()
      .use(withDB)
      .input(
        z.object({
          profileId: z.string().uuid(),
          name: z.string().trim().min(1).max(80),
        }),
      )
      .output(collectionEncoder)
      .mutation(async ({ input, ctx }) => {
        const row = await createCollection(
          ctx.user.id,
          input.profileId,
          input.name,
        );
        ctx.registerMutationChannels([
          Channels.profileCollections(input.profileId),
        ]);
        return collectionEncoder.parse(row);
      }),

    rename: commonAuthedProcedure()
      .use(withDB)
      .input(
        z.object({
          id: z.string().uuid(),
          name: z.string().trim().min(1).max(80),
        }),
      )
      .output(collectionEncoder)
      .mutation(async ({ input, ctx }) => {
        const row = await renameCollection(ctx.user.id, input.id, input.name);
        const profileIds = await getProfileIdsForCollection(input.id);
        ctx.registerMutationChannels(
          profileIds.map((id) => Channels.profileCollections(id)),
        );
        return collectionEncoder.parse(row);
      }),

    reorder: commonAuthedProcedure()
      .use(withDB)
      .input(reorderInput)
      .output(collectionEncoder)
      .mutation(async ({ input, ctx }) => {
        const row = await reorderCollection(
          ctx.user.id,
          input.id,
          input.upperNeighborId,
        );
        const profileIds = await getProfileIdsForCollection(input.id);
        ctx.registerMutationChannels(
          profileIds.map((id) => Channels.profileCollections(id)),
        );
        return collectionEncoder.parse(row);
      }),

    delete: commonAuthedProcedure()
      .use(withDB)
      .input(z.object({ id: z.string().uuid() }))
      .output(z.object({ ok: z.literal(true) }))
      .mutation(async ({ input, ctx }) => {
        const profileIds = await getProfileIdsForCollection(input.id);
        const result = await deleteCollection(ctx.user.id, input.id);
        ctx.registerMutationChannels(collectionChannels(profileIds, input.id));
        return result;
      }),
  }),
});
