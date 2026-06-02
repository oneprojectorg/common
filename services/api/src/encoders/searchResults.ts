import { storageItemMinimalSchema } from '@op/common/client';
import { EntityType, organizations, users } from '@op/db/schema';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

import { baseProfileEncoder } from './baseProfile';

// The search service over-selects every column; these encoders pick it back
// down to what the UI reads, so PII and internal FKs aren't forwarded.

// Raw table, not organizationsEncoder, which transforms its output.
const searchOrganizationEncoder = createSelectSchema(organizations)
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
    whereWeWork: z
      .array(
        z.object({
          name: z.string(),
        }),
      )
      .optional(),
  })
  .nullable();

const searchUserEncoder = createSelectSchema(users)
  .pick({
    id: true,
    name: true,
    email: true,
  })
  .nullable();

// Picked from baseProfileEncoder so search can't expose more than the profile.
export const profileSearchResultEncoder = baseProfileEncoder
  .pick({
    id: true,
    name: true,
    slug: true,
    type: true,
    bio: true,
    city: true,
  })
  .extend({
    avatarImage: storageItemMinimalSchema.nullable(),
    organization: searchOrganizationEncoder,
    user: searchUserEncoder,
    rank: z.coerce.number(),
  });

export const searchProfilesResultEncoder = z.array(
  z.object({
    type: z.enum(EntityType),
    results: z.array(profileSearchResultEncoder),
  }),
);

export type ProfileSearchResult = z.infer<typeof profileSearchResultEncoder>;
export type SearchProfilesResult = z.infer<typeof searchProfilesResultEncoder>;
