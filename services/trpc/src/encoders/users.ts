import { createSelectSchema } from 'drizzle-zod';

import { objectsInStorage, organizationUsers, users } from '@op/db/schema';

export const userEncoder = createSelectSchema(users).extend({
  avatarImage: createSelectSchema(objectsInStorage).nullish(),
  organizationUsers: createSelectSchema(organizationUsers).array().nullish(),
});
