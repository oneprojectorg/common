import { comments } from '@op/db/schema';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

import { profileEncoder } from './profiles';

export const commentsEncoder = createSelectSchema(comments)
  .extend({
    profile: profileEncoder.nullish(),
    parentComment: z
      .object({
        id: z.string(),
        content: z.string(),
        createdAt: z.date(),
        profileId: z.string(),
      })
      .nullish(),
    childComments: z
      .array(
        z.object({
          id: z.string(),
          content: z.string(),
          createdAt: z.date(),
          profileId: z.string(),
        }),
      )
      .nullish(),
  })
  .strip();

export type Comment = z.infer<typeof commentsEncoder>;