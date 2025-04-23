import { createSelectSchema } from 'drizzle-zod';

import { users } from '@op/db/schema';

export const userEncoder = createSelectSchema(users);
