import { createSelectSchema } from 'drizzle-zod';

import { objectsInStorage, users } from '@op/db/schema';

export const userEncoder = createSelectSchema(users).extend({
  avatarImage: createSelectSchema(objectsInStorage).nullish(),
});
