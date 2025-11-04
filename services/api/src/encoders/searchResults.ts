import {
  EntityType,
  objectsInStorage,
  organizations,
  profiles,
  users,
} from '@op/db/schema';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

// Storage encoder for search results that accepts raw database format from LEFT JOIN
// Uses createSelectSchema to handle all objectsInStorage fields and make them nullable
const searchStorageObjectEncoder = createSelectSchema(objectsInStorage).nullable();

// Search-specific organization encoder (nullable fields from left join)
// Include whereWeWork array which is used by ProfileSummaryList
// Make links, receivingFundsTerms, and strategies optional since they're not in the base table
const searchOrganizationEncoder = createSelectSchema(organizations)
  .extend({
    whereWeWork: z
      .array(
        z.object({
          name: z.string(),
        }),
      )
      .optional(),
    links: z.array(z.any()).optional(),
    receivingFundsTerms: z.array(z.any()).optional(),
    strategies: z.array(z.any()).optional(),
  })
  .nullable();

// Search-specific user encoder (nullable fields from left join)
const searchUserEncoder = createSelectSchema(users).nullable();

// Profile search result encoder
export const profileSearchResultEncoder = createSelectSchema(profiles).extend({
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
