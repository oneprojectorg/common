import { listJoinProfileRequests } from '@op/common';
import { JoinProfileRequestStatus } from '@op/db/schema';
import { z } from 'zod';

import { baseProfileEncoder } from '../../encoders/profiles';
import { storageItemEncoder } from '../../encoders/storageItem';
import withAuthenticated from '../../middlewares/withAuthenticated';
import withRateLimited from '../../middlewares/withRateLimited';
import { loggedProcedure, router } from '../../trpcFactory';
import { dbFilter } from '../../utils';

const joinProfileRequestEncoder = z.object({
  id: z.string(),
  requestProfileId: z.string().nullable(),
  targetProfileId: z.string().nullable(),
  status: z.nativeEnum(JoinProfileRequestStatus),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  requestProfile: baseProfileEncoder
    .pick({
      id: true,
      name: true,
      slug: true,
      type: true,
    })
    .extend({
      avatarImage: storageItemEncoder.nullish(),
    })
    .nullable(),
});

const inputSchema = dbFilter.extend({
  /** The profile ID of the target to list requests for */
  targetProfileId: z.uuid(),
  /** Optional status filter */
  status: z.nativeEnum(JoinProfileRequestStatus).optional(),
});

export const listJoinProfileRequestsRouter = router({
  listJoinProfileRequests: loggedProcedure
    .use(withRateLimited({ windowSize: 60, maxRequests: 30 }))
    .use(withAuthenticated)
    .input(inputSchema)
    .output(
      z.object({
        items: z.array(joinProfileRequestEncoder),
        next: z.string().nullish(),
        hasMore: z.boolean(),
      }),
    )
    .query(async ({ input }) => {
      const { targetProfileId, status, limit, cursor, dir } = input;

      const { items, next, hasMore } = await listJoinProfileRequests({
        targetProfileId,
        status,
        cursor,
        limit,
        dir,
      });

      return {
        items: items.map((item) => joinProfileRequestEncoder.parse(item)),
        next,
        hasMore,
      };
    }),
});
