import { Channels, listProfileJoinRequests } from '@op/common';
import { PAGE_LIMIT } from '@op/common/client';
import { JoinProfileRequestStatus } from '@op/db/schema';
import { z } from 'zod';

import { joinProfileRequestEncoder } from '../../../encoders/joinProfileRequests';
import { networkAuthenticatedProcedure, router } from '../../../trpcFactory';
import { dbFilter } from '../../../utils';

const inputSchema = dbFilter.extend({
  /** The profile ID of the target to view join requests for */
  targetProfileId: z.uuid(),
  /** Optional status to filter requests by */
  status: z.enum(JoinProfileRequestStatus).optional(),
});

export const listJoinRequestsRouter = router({
  listJoinRequests: networkAuthenticatedProcedure({
    rateLimit: { windowSize: 60, maxRequests: 60 },
  })
    .input(inputSchema)
    .output(
      z.object({
        items: z.array(joinProfileRequestEncoder),
        next: z.string().nullish(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { limit = PAGE_LIMIT.sm, cursor, dir } = input;

      const { items, next } = await listProfileJoinRequests({
        user: ctx.user,
        targetProfileId: input.targetProfileId,
        status: input.status,
        cursor,
        limit,
        dir,
      });

      ctx.registerQueryChannels([
        Channels.profileJoinRequest({
          type: 'target',
          profileId: input.targetProfileId,
        }),
      ]);

      return {
        items: items.map((item) => joinProfileRequestEncoder.parse(item)),
        next,
      };
    }),
});
