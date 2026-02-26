import { profiles } from '@op/db/schema';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

import { individualsEncoder } from './individuals';
import { storageItemEncoder } from './storageItem';

/**
 * Base profile encoder without organization reference.
 * Extracted into its own file to break the circular dependency
 * between profiles.ts ↔ organizations.ts.
 */
export const baseProfileEncoder = createSelectSchema(profiles)
  .pick({
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
    id: z.uuid(),
    headerImage: storageItemEncoder.nullish(),
    avatarImage: storageItemEncoder.nullish(),
    individual: individualsEncoder.pick({ pronouns: true }).nullish(),
  });
