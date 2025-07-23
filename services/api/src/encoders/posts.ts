import { attachments, posts, postsToOrganizations } from '@op/db/schema';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

import { organizationsWithProfileEncoder } from './organizations';
import { profileWithAvatarEncoder } from './profiles';
import { storageItemEncoder } from './storageItem';

export const postAttachmentEncoder = createSelectSchema(attachments).extend({
  storageObject: storageItemEncoder,
});

export const postsEncoder: z.ZodType<any> = createSelectSchema(posts)
  .extend({
    attachments: z.array(postAttachmentEncoder).nullish(),
    reactionCounts: z.record(z.string(), z.number()),
    userReaction: z.string().nullish(),
    profile: profileWithAvatarEncoder.nullish(),
    childPosts: z.array(z.lazy(() => postsEncoder)).nullish(),
    parentPost: z.lazy(() => postsEncoder).nullish(),
  })
  .strip();

export type Post = z.infer<typeof postsEncoder>;

export const postsToOrganizationsEncoder = createSelectSchema(
  postsToOrganizations,
).extend({
  post: postsEncoder,
  organization: organizationsWithProfileEncoder.nullish(),
});

export type PostToOrganization = z.infer<typeof postsToOrganizationsEncoder>;
