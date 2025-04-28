import { objectsInStorage, organizationUsers, users } from '@op/db/schema';
import { createSelectSchema } from 'drizzle-zod';

export const userEncoder = createSelectSchema(users).extend({
  avatarImage: createSelectSchema(objectsInStorage).nullish(),
  organizationUsers: createSelectSchema(organizationUsers).array().nullish(),
});
