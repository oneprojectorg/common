import {
  EntityType,
  objectsInStorage,
  organizations,
  users,
} from '@op/db/schema';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

import { baseProfileEncoder } from './baseProfile';

// The search service over-selects every column; these encoders are the output
// boundary that picks back down to what the UI reads. Never bare
// createSelectSchema here — that would forward PII and internal FKs.

const searchStorageObjectEncoder = createSelectSchema(objectsInStorage)
  .pick({
    id: true,
    name: true,
  })
  .nullable();

// On the raw table, not organizationsEncoder: this validates raw left-join rows,
// before that encoder's output transforms (e.g. acceptingApplications default).
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

// Only email is read (member/invite dedupe).
const searchUserEncoder = createSelectSchema(users)
  .pick({
    id: true,
    name: true,
    email: true,
  })
  .nullable();

// Picked from baseProfileEncoder so search can't expose more than the public
// profile does (notably not email/phone/address).
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
    avatarImage: searchStorageObjectEncoder,
    organization: searchOrganizationEncoder,
    user: searchUserEncoder,
    rank: z.coerce.number(), // raw SQL result is unknown
  });

// Results grouped by entity type
export const searchProfilesResultEncoder = z.array(
  z.object({
    type: z.enum(EntityType),
    results: z.array(profileSearchResultEncoder),
  }),
);

export type ProfileSearchResult = z.infer<typeof profileSearchResultEncoder>;
export type SearchProfilesResult = z.infer<typeof searchProfilesResultEncoder>;
