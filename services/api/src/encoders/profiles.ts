import {
  organizations,
  profileInvites,
  profileUsers,
  profiles,
} from '@op/db/schema';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

import { accessRoleMinimalEncoder } from './access';
import { individualsEncoder } from './individuals';
import { linksEncoder } from './links';
import { locationEncoder } from './locations';
import { type organizationsEncoder } from './organizations';
import { projectEncoder } from './projects';
import { storageItemMinimalEncoder } from './shared';
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
  organization: z
    .lazy<
      typeof organizationsEncoder
    >(() => require('./organizations').organizationsEncoder)
    .nullish(),
});

export const profileWithAvatarEncoder = baseProfileEncoder;

// Minimal profile encoder for nested references (e.g., in profileUser, invites)
export const profileMinimalEncoder = baseProfileEncoder
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
  });

export type Profile = z.infer<typeof profileEncoder>;

// Profile user encoders - using createSelectSchema for base fields
export const profileUserEncoder = createSelectSchema(profileUsers).extend({
  // Override timestamp fields to handle both string and Date, and allow null/undefined
  createdAt: z.union([z.string(), z.date()]).nullish(),
  updatedAt: z.union([z.string(), z.date()]).nullish(),
  deletedAt: z.union([z.string(), z.date()]).nullish(),
  profile: profileMinimalEncoder.nullable(),
  roles: z.array(accessRoleMinimalEncoder),
});

// Profile invite encoder for pending invitations
// accessRoleId is NOT NULL in schema, so role is always present
export const profileInviteEncoder = createSelectSchema(profileInvites)
  .pick({
    id: true,
    email: true,
    profileId: true,
    createdAt: true,
  })
  .extend({
    role: accessRoleMinimalEncoder,
  });

export type ProfileUser = z.infer<typeof profileUserEncoder>;
