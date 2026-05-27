import {
  Channels,
  createCollection,
  deleteCollection,
  getProfileIdsForCollection,
  listCollections,
  reorderCollection,
  updateCollection,
} from '@op/common';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';
import { collectionEncoder } from './encoders';

const reorderInput = z.object({
  id: z.string().uuid(),
  upperNeighborId: z.string().uuid().nullable(),
});

const updatePatchSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'At least one field must be provided',
  });

const collectionChannels = (profileIds: string[], collectionId: string) => [
  ...profileIds.map((id) => Channels.profileCollections(id)),
  ...profileIds.map((id) => Channels.profileResources(id)),
  Channels.collectionResources(collectionId),
];

export const collectionsRouter = router({
  collections: router({
    list: commonAuthedProcedure()
      .input(z.object({ profileId: z.string().uuid() }))
      .output(z.array(collectionEncoder))
      .query(async ({ input, ctx }) => {
        const rows = await listCollections({
          authUserId: ctx.user.id,
          profileId: input.profileId,
        });
        ctx.registerQueryChannels([
          Channels.profileCollections(input.profileId),
        ]);
        return rows.map((row) => collectionEncoder.parse(row));
      }),

    create: commonAuthedProcedure()
      .input(
        z.object({
          profileId: z.string().uuid(),
          name: z.string().trim().min(1).max(80),
        }),
      )
      .output(collectionEncoder)
      .mutation(async ({ input, ctx }) => {
        const row = await createCollection({
          authUserId: ctx.user.id,
          profileId: input.profileId,
          name: input.name,
        });
        ctx.registerMutationChannels([
          Channels.profileCollections(input.profileId),
        ]);
        return collectionEncoder.parse(row);
      }),

    update: commonAuthedProcedure()
      .input(z.object({ id: z.string().uuid(), patch: updatePatchSchema }))
      .output(collectionEncoder)
      .mutation(async ({ input, ctx }) => {
        const row = await updateCollection({
          authUserId: ctx.user.id,
          id: input.id,
          patch: input.patch,
        });
        const profileIds = await getProfileIdsForCollection(input.id);
        ctx.registerMutationChannels(
          profileIds.map((id) => Channels.profileCollections(id)),
        );
        return collectionEncoder.parse(row);
      }),

    reorder: commonAuthedProcedure()
      .input(reorderInput)
      .output(collectionEncoder)
      .mutation(async ({ input, ctx }) => {
        const row = await reorderCollection({
          authUserId: ctx.user.id,
          id: input.id,
          upperNeighborId: input.upperNeighborId,
        });
        const profileIds = await getProfileIdsForCollection(input.id);
        ctx.registerMutationChannels(
          profileIds.map((id) => Channels.profileCollections(id)),
        );
        return collectionEncoder.parse(row);
      }),

    delete: commonAuthedProcedure()
      .input(z.object({ id: z.string().uuid() }))
      .output(z.object({ ok: z.literal(true) }))
      .mutation(async ({ input, ctx }) => {
        const profileIds = await getProfileIdsForCollection(input.id);
        const result = await deleteCollection({
          authUserId: ctx.user.id,
          id: input.id,
        });
        ctx.registerMutationChannels(collectionChannels(profileIds, input.id));
        return result;
      }),
  }),
});
