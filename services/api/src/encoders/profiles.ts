import { profileUsers, profiles } from '@op/db/schema';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

import { individualsEncoder } from './individuals';
import { type organizationsEncoder } from './organizations';
import { accessRoleMinimalEncoder, storageItemMinimalEncoder } from './shared';
import { storageItemEncoder } from './storageItem';

// Base profile encoder without organization reference
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
    modules: z
      .array(
        z.object({
          slug: z.string(),
        }),
      )
      .optional(),
  });

// Profile encoder with organization reference
export const profileEncoder = baseProfileEncoder.extend({
  organization: z
    .lazy<
      typeof organizationsEncoder
    >(() => require('./organizations').organizationsEncoder)
    .nullish(),
});

export const profileWithAvatarEncoder = baseProfileEncoder;

export type Profile = z.infer<typeof profileEncoder>;

// Profile user encoders - using createSelectSchema for base fields
export const profileUserEncoder = createSelectSchema(profileUsers).extend({
  // Override timestamp fields to handle both string and Date, and allow null/undefined
  createdAt: z.union([z.string(), z.date()]).nullish(),
  updatedAt: z.union([z.string(), z.date()]).nullish(),
  deletedAt: z.union([z.string(), z.date()]).nullish(),
  // Nested profile with minimal fields needed for display
  profile: baseProfileEncoder
    .pick({
      id: true,
      name: true,
      slug: true,
      bio: true,
      email: true,
      type: true,
    })
    .extend({
      avatarImage: storageItemMinimalEncoder.nullable(),
    })
    .nullable(),
  // Roles using shared minimal encoder
  roles: z.array(accessRoleMinimalEncoder),
});

export const profileUserListEncoder = z.array(profileUserEncoder);

// Profile user input schemas
export const listProfileUsersInputSchema = z.object({
  profileId: z.uuid(),
});

export const addProfileUserInputSchema = z.object({
  profileId: z.uuid(),
  email: z.string().email(),
  roleId: z.uuid(),
  personalMessage: z.string().optional(),
});

export const updateProfileUserRoleInputSchema = z.object({
  profileUserId: z.uuid(),
  roleId: z.uuid(),
});

export const removeProfileUserInputSchema = z.object({
  profileUserId: z.uuid(),
});
