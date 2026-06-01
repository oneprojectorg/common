import { profiles } from '@op/db/schema';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

// Minimal storage item reference (avatar/header) — id + name only.
export const storageItemMinimalSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
});

export type StorageItemMinimal = z.infer<typeof storageItemMinimalSchema>;

// Minimal profile shape for nested references (profile user, invitee).
export const profileMinimalSchema = createSelectSchema(profiles)
  .pick({
    id: true,
    name: true,
    slug: true,
    bio: true,
    email: true,
    type: true,
  })
  .extend({
    avatarImage: storageItemMinimalSchema.nullable(),
  });

export type ProfileMinimal = z.infer<typeof profileMinimalSchema>;
