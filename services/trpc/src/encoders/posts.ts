import { posts, postsToOrganizations } from '@op/db/schema';
import { createSelectSchema } from 'drizzle-zod';
import type { z } from 'zod';

export const postsEncoder = createSelectSchema(posts).strip();

export type Post = z.infer<typeof postsEncoder>;

export const postsToOrganizationsEncoder = createSelectSchema(
  postsToOrganizations,
).extend({
  post: postsEncoder,
});

export type PostToOrganization = z.infer<typeof postsEncoder>;
