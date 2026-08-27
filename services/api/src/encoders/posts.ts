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
    attachments: z.array(postAttachmentEncoder).prefault([]),
    likeCount: z.number(),
    userHasLiked: z.boolean(),
    // Likers the read could name. Fewer than `likeCount` when a reaction's
    // profile didn't join, so this drives the tooltip and never the count.
    likeUsers: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          timestamp: z.date(),
        }),
      )
      .optional(),
    commentCount: z.number(),
    // True only on posts the read filters let through to their author or an
    // admin while an active moderation flag hides them from everyone else;
    // drives the "Flagged" indicator. Absent on legacy/unenriched payloads.
    isFlagged: z.boolean().optional(),
    profile: profileWithAvatarEncoder.nullish(),
  })
  .strip();

// Define the recursive relationship properly
export const postsEncoder: z.ZodType<Post> = basePostsEncoder.extend({
  childPosts: z.array(z.lazy(() => postsEncoder)).nullish(),
  parentPost: z.lazy(() => postsEncoder).nullish(),
}) as z.ZodType<Post>;

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
