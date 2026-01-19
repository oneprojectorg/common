import { profiles } from '@op/db/schema';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

import { individualsEncoder } from './individuals';
import { type organizationsEncoder } from './organizations';
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

// Profile user encoders
export const profileUserEncoder = z.object({
  id: z.string(),
  authUserId: z.string(),
  name: z.string().nullable(),
  email: z.string(),
  about: z.string().nullable(),
  profileId: z.string(),
  createdAt: z.union([z.string(), z.date()]).nullable(),
  updatedAt: z.union([z.string(), z.date()]).nullable(),
  profile: z
    .object({
      id: z.string(),
      name: z.string().nullable(),
      slug: z.string(),
      bio: z.string().nullable(),
      email: z.string().nullable(),
      type: z.string(),
      avatarImage: z
        .object({
          id: z.string(),
          name: z.string().nullable(),
        })
        .nullable(),
    })
    .nullable(),
  roles: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().nullable(),
    }),
  ),
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
