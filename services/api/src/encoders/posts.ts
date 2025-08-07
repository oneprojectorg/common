import { attachments, posts, postsToOrganizations } from '@op/db/schema';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

import { organizationsWithProfileEncoder } from './organizations';
import { profileWithAvatarEncoder } from './profiles';
import { storageItemEncoder } from './storageItem';

export const postAttachmentEncoder = createSelectSchema(attachments).extend({
  storageObject: storageItemEncoder,
});

const basePostsEncoder = createSelectSchema(posts)
  .extend({
    attachments: z.array(postAttachmentEncoder).default([]),
    reactionCounts: z.record(z.string(), z.number()),
    reactionUsers: z
      .record(
        z.string(),
        z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            timestamp: z.date(),
          }),
        ),
      )
      .optional(),
    userReaction: z.string().nullish(),
    commentCount: z.number(),
    profile: profileWithAvatarEncoder.nullish(),
  })
  .strip();

// Define the recursive relationship properly
export const postsEncoder: z.ZodSchema<Post> = basePostsEncoder.extend({
  childPosts: z.array(z.lazy(() => postsEncoder)).nullish(),
  parentPost: z.lazy(() => postsEncoder).nullish(),
}) as z.ZodSchema<Post>;

export type Post = z.infer<typeof basePostsEncoder> & {
  childPosts: Post[] | null;
  parentPost?: Post | null;
};

// export type Post = z.infer<typeof postsEncoder>;

export const postsToOrganizationsEncoder = createSelectSchema(
  postsToOrganizations,
).extend({
  post: postsEncoder,
  organization: organizationsWithProfileEncoder.nullish(),
});

export type PostAttachment = z.infer<typeof postAttachmentEncoder>;
export type PostToOrganization = z.infer<typeof postsToOrganizationsEncoder>;
