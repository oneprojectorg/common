import { comments } from '@op/db/schema';
import { getCommentsSchema } from '@op/types';
import { TRPCError } from '@trpc/server';
import { desc } from 'drizzle-orm';
import type { OpenApiMeta } from 'trpc-to-openapi';
import { z } from 'zod';

import { commentsEncoder } from '../../encoders';
import withDB from '../../middlewares/withDB';
import { loggedProcedure, router } from '../../trpcFactory';

const meta: OpenApiMeta = {
  openapi: {
    enabled: true,
    method: 'GET',
    path: '/comments',
    protect: false,
    tags: ['comments'],
    summary: 'Get comments for a post',
  },
};

const outputSchema = z.array(commentsEncoder.strip());

export const getComments = router({
  getComments: loggedProcedure
    .use(withDB)
    .meta(meta)
    .input(getCommentsSchema)
    .output(outputSchema)
    .query(async ({ input, ctx }) => {
      const { db } = ctx.database;

      try {
        const commentsData = await db.query.comments.findMany({
          where: (table, { eq }) => eq(table.postId, input.postId),
          orderBy: [desc(comments.createdAt)],
          limit: input.limit,
          offset: input.offset,
          with: {
            profile: true,
            parentComment: true,
            childComments: true,
          },
        });

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