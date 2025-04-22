import { createSelectSchema } from 'drizzle-zod';

import { organizationUsers } from '@op/db/schema';

export const userEncoder = createSelectSchema(organizationUsers);
