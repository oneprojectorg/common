import { profiles } from '@op/db/schema';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

import { type organizationsEncoder } from './organizations';
import { storageItemEncoder } from './storageItem';

// Base profile encoder without organization reference
export const baseProfileEncoder = createSelectSchema(profiles)
  .pick({
    id: true,
    type: true,
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

// Profile encoder with organization reference (will be extended in organizations.ts)
export const profileEncoder = baseProfileEncoder.extend({
  organization: z
    .lazy<
      typeof organizationsEncoder
    >(() => require('./organizations').organizationsEncoder)
    .nullish(),
});

export type Profile = z.infer<typeof profileEncoder>;
