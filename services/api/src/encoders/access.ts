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

// Minimal access role encoder for contexts where we only need basic role info
export const accessRoleMinimalEncoder = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
});

export type AccessRoleMinimal = z.infer<typeof accessRoleMinimalEncoder>;

// Decision role permissions schema
export const decisionRoleEncoder = z.object({
  admin: z.boolean(),
  inviteMembers: z.boolean(),
  review: z.boolean(),
  submitProposals: z.boolean(),
  vote: z.boolean(),
});
