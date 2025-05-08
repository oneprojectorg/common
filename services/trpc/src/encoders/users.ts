import { objectsInStorage, organizationUsers, users } from '@op/db/schema';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

import { organizationsEncoder } from './organizations';

export const userEncoder = createSelectSchema(users).extend({
  avatarImage: createSelectSchema(objectsInStorage).nullish(),
  organizationUsers: createSelectSchema(organizationUsers).array().nullish(),
  currentOrganization: organizationsEncoder.nullish(),
});

export type CommonUser = z.infer<typeof userEncoder>;
