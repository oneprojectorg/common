import { profiles } from '@op/db/schema';
import { createSelectSchema } from 'drizzle-zod';

import { storageItemEncoder } from './storageItem';

export const profileEncoder = createSelectSchema(profiles)
  .pick({
    slug: true,
    name: true,
    city: true,
    state: true,
    bio: true,
    mission: true,
    email: true,
    website: true,
  })
  .extend({
    headerImage: storageItemEncoder.nullish(),
    avatarImage: storageItemEncoder.nullish(),
  });
