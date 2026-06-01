import {
  EntityType,
  objectsInStorage,
  organizations,
  profiles,
  users,
} from '@op/db/schema';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

// The search service over-selects every column via `getTableColumns`; these
// output encoders are the boundary that strips it back down. Keep them picked
// to the fields the search UI actually reads — never bare createSelectSchema,
// which would forward PII and internal FKs.

const searchStorageObjectEncoder = createSelectSchema(objectsInStorage)
  .pick({
    id: true,
    name: true,
  })
  .nullable();

// Mirrors the config columns organizationsEncoder exposes; only whereWeWork is read.
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

// Only email is read (member/invite dedupe); drops the user table's internal FKs.
const searchUserEncoder = createSelectSchema(users)
  .pick({
    id: true,
    name: true,
    email: true,
  })
  .nullable();

// Stays within what baseProfileEncoder exposes — must not leak phone/address/postalCode.
export const profileSearchResultEncoder = createSelectSchema(profiles)
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
    rank: z.coerce.number(), // Coerce from unknown (raw SQL result) to number
  });

// Discriminated union for search results grouped by entity type
export const searchProfilesResultEncoder = z.array(
  z.object({
    type: z.enum(EntityType),
    results: z.array(profileSearchResultEncoder),
  }),
);

export type ProfileSearchResult = z.infer<typeof profileSearchResultEncoder>;
export type SearchProfilesResult = z.infer<typeof searchProfilesResultEncoder>;
