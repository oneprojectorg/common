import { z } from 'zod';

// Permissions schema for CRUD + admin access
export const permissionsSchema = z.object({
  admin: z.boolean(),
  create: z.boolean(),
  read: z.boolean(),
  update: z.boolean(),
  delete: z.boolean(),
});

export type Permissions = z.infer<typeof permissionsSchema>;

export const entityTermsEncoder = z.record(
  z.string(),
  z.array(
    z.object({
      termUri: z.string(),
      taxonomyUri: z.string(),
      id: z.string(),
      label: z.string(),
      facet: z.string().nullish(),
    }),
  ),
);

export type EntityTerms = z.infer<typeof entityTermsEncoder>;

// Minimal access role encoder for contexts where we only need basic role info
export const accessRoleMinimalEncoder = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
});

export type AccessRoleMinimal = z.infer<typeof accessRoleMinimalEncoder>;

// Minimal storage item encoder for avatar/image references where we only need id and name
export const storageItemMinimalEncoder = z.object({
  id: z.string(),
  name: z.string().nullable(),
});

export type StorageItemMinimal = z.infer<typeof storageItemMinimalEncoder>;
