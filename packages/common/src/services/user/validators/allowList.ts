import type { AllowList } from '@op/db/schema';
import { z } from 'zod';

/**
 * Schema for allowList metadata field
 * Used to store additional information about allowList entries, such as assigned roles
 */
export const allowListMetadataSchema = z
  .object({
    invitedBy: z.string().optional(),
    invitedAt: z.string().optional(),
    inviteType: z
      .enum(['existing_organization', 'new_organization'])
      .optional(),
    personalMessage: z.string().optional(),
    roleId: z.string().optional(),
    organizationId: z.string().optional(),
    inviterOrganizationName: z.string().optional(),
  })
  .nullable();

export type AllowListMetadata = z.infer<typeof allowListMetadataSchema>;

/**
 * Type for the subset of AllowList fields returned by getAllowListUser
 * Uses the database schema and the parsed metadata type.
 */
export type AllowListUser = Pick<
  AllowList,
  'email' | 'organizationId' | 'metadata'
> & {
  metadata: AllowListMetadata;
};
