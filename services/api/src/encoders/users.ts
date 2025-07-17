import { objectsInStorage, organizationUsers, users } from '@op/db/schema';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

import { organizationsEncoder } from './organizations';
import { profileEncoder } from './profiles';

export const userEncoder = createSelectSchema(users).extend({
  avatarImage: createSelectSchema(objectsInStorage).nullish(),
  organizationUsers: createSelectSchema(organizationUsers)
    .extend({
      organization: organizationsEncoder.nullish(),
    })
    .array()
    .nullish(),
  currentOrganization: organizationsEncoder.nullish(),
  currentProfile: profileEncoder.nullish(),
  profile: profileEncoder.nullish(),
});

export type CommonUser = z.infer<typeof userEncoder>;
