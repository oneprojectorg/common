import {
  createCollection,
  deleteCollection,
  listCollections,
  renameCollection,
  reorderCollection,
} from '@op/common';
import { z } from 'zod';

import withDB from '../../middlewares/withDB';
import { commonAuthedProcedure, router } from '../../trpcFactory';
import { collectionEncoder } from './encoders';

const reorderInput = z
  .object({
    id: z.string().uuid(),
    beforeId: z.string().uuid().optional(),
    afterId: z.string().uuid().optional(),
  })
  .refine((v) => (v.beforeId === undefined) !== (v.afterId === undefined), {
    message: 'Exactly one of beforeId / afterId is required',
  });

export const collectionsRouter = router({
  collections: router({
    list: commonAuthedProcedure()
      .use(withDB)
      .input(z.object({ profileId: z.string().uuid() }))
      .output(z.array(collectionEncoder))
      .query(async ({ input, ctx }) => {
        const rows = await listCollections(ctx.user.id, input.profileId);
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
          input.beforeId,
          input.afterId,
        );
        return collectionEncoder.parse(row);
      }),

    delete: commonAuthedProcedure()
      .use(withDB)
      .input(z.object({ id: z.string().uuid() }))
      .output(z.object({ ok: z.literal(true) }))
      .mutation(async ({ input, ctx }) => {
        return deleteCollection(ctx.user.id, input.id);
      }),
  }),
});
