import { attachments, posts, postsToOrganizations } from '@op/db/schema';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

import { organizationsWithProfileEncoder } from './organizations';
import { profileWithAvatarEncoder } from './profiles';
import { storageItemEncoder } from './storageItem';

export const postAttachmentEncoder = createSelectSchema(attachments).extend({
  storageObject: storageItemEncoder,
});

export const postsEncoder = createSelectSchema(posts)
  .extend({
    attachments: z.array(postAttachmentEncoder).default([]),
    reactionCounts: z.record(z.string(), z.number()),
    userReaction: z.string().nullish(),
    commentCount: z.number(),
    profile: profileWithAvatarEncoder.nullish(),
    // TODO: circular references produce issues in zod so are typed as any for now
    childPosts: z.array(z.lazy((): z.ZodType<any> => postsEncoder)).nullish(),
    parentPost: z.lazy((): z.ZodType<any> => postsEncoder).nullish(),
  })
  .strip();

export type Post = z.infer<typeof postsEncoder>;

export const postsToOrganizationsEncoder = createSelectSchema(
  postsToOrganizations,
).extend({
  post: postsEncoder,
  organization: organizationsWithProfileEncoder.nullish(),
});

export type PostAttachment = z.infer<typeof postAttachmentEncoder>;
export type PostToOrganization = z.infer<typeof postsToOrganizationsEncoder>;
