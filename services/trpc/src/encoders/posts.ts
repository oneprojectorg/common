import { posts } from '@op/db/schema';
import { createSelectSchema } from 'drizzle-zod';

import type { z } from 'zod';

export const postsEncoder = createSelectSchema(posts);

export type Post = z.infer<typeof postsEncoder>;
