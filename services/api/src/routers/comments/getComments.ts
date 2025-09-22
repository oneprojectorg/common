import { getComments as getCommentsService } from '@op/common';
import { getCommentsSchema } from '@op/types';
import { TRPCError } from '@trpc/server';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import { commentsEncoder } from '../../encoders';
import withAuthenticated from '../../middlewares/withAuthenticated';
import withAnalytics from '../../middlewares/withAnalytics';
import { loggedProcedure, router } from '../../trpcFactory';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'GET',
    path: '/comments',
    protect: true,
    tags: ['comments'],
    summary: 'Get comments for a post',
  },
};

const outputSchema = z.array(commentsEncoder.strip());

export const getComments = router({
  getComments: loggedProcedure
    .use(withAuthenticated)
    .use(withAnalytics)
    .meta(meta)
    .input(getCommentsSchema)
    .output(outputSchema)
    .query(async ({ input }) => {
      try {
        const commentsData = await getCommentsService(input);
        const output = outputSchema.parse(commentsData);
        return output;
      } catch (error) {
        console.log('ERROR', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Something went wrong when fetching comments',
        });
      }
    }),
});
