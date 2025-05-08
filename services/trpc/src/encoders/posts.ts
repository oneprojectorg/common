import { posts, postsToOrganizations } from '@op/db/schema';
import { createSelectSchema } from 'drizzle-zod';
import type { z } from 'zod';

import { organizationsEncoder } from './organizations';

export const postsEncoder = createSelectSchema(posts).strip();

export type Post = z.infer<typeof postsEncoder>;

export const postsToOrganizationsEncoder = createSelectSchema(
  postsToOrganizations,
).extend({
  post: postsEncoder,
  organization: organizationsEncoder.nullish(),
});

export type PostToOrganization = z.infer<typeof postsToOrganizationsEncoder>;
