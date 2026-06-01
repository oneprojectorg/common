import { profileMinimalSchema } from '@op/common/client';
import { organizations, profileInvites } from '@op/db/schema';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

import { baseProfileEncoder } from './baseProfile';
import { linksEncoder } from './links';
import { locationEncoder } from './locations';
import { organizationsEncoder } from './organizations';
import { projectEncoder } from './projects';
import { storageItemEncoder } from './storageItem';

export { baseProfileEncoder } from './baseProfile';

// Minimal organization encoder for profile listing context
// Only includes fields actually fetched by listProfiles - does NOT include
// strategies, receivingFundsTerms, or nested profile (already at top level)
const organizationMinimalEncoder = createSelectSchema(organizations)
  .pick({
    id: true,
    isOfferingFunds: true,
    isReceivingFunds: true,
    acceptingApplications: true,
    networkOrganization: true,
    orgType: true,
    domain: true,
  })
  .extend({
    projects: z.array(projectEncoder).optional(),
    links: z.array(linksEncoder).optional().default([]),
    whereWeWork: z.array(locationEncoder).optional().default([]),
    headerImage: storageItemEncoder.nullish(),
    avatarImage: storageItemEncoder.nullish(),
  });

// Profile encoder with minimal organization reference for list operations
export const profileEncoder = baseProfileEncoder.extend({
  organization: organizationMinimalEncoder.nullish(),
});

// Profile encoder with full organization reference for detail operations
export const profileWithFullOrgEncoder = baseProfileEncoder.extend({
  organization: organizationsEncoder.nullish(),
});

export const profileWithAvatarEncoder = baseProfileEncoder;

export type Profile = z.infer<typeof profileEncoder>;

// Profile invite encoder for pending invitations returned by listProfileInvites
export const profileInviteEncoder = createSelectSchema(profileInvites)
  .pick({
    id: true,
    email: true,
    accessRoleId: true,
    createdAt: true,
    notifiedAt: true,
  })
  .extend({
    inviteeProfile: profileMinimalSchema.nullable(),
  });

export type ProfileInvite = z.infer<typeof profileInviteEncoder>;
