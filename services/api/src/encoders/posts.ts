import { attachments, posts, postsToOrganizations } from '@op/db/schema';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

import { organizationsEncoder } from './organizations';
import { storageItemEncoder } from './storageItem';

export const postAttachmentEncoder = createSelectSchema(attachments).extend({
  storageObject: storageItemEncoder,
});

export const postsEncoder = createSelectSchema(posts)
  .extend({
    attachments: z.array(postAttachmentEncoder).nullish(),
    reactionCounts: z.record(z.string(), z.number()),
    userReaction: z.string().nullish(),
  })
  .strip();

export type Post = z.infer<typeof postsEncoder>;

export const postsToOrganizationsEncoder = createSelectSchema(
  postsToOrganizations,
).extend({
  post: postsEncoder,
  organization: organizationsEncoder.nullish(),
});

export type PostToOrganization = z.infer<typeof postsToOrganizationsEncoder>;
