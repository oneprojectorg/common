import { defineRelations } from 'drizzle-orm';

import * as schema from './schema';

/**
 * Drizzle Relations v2 definitions
 *
 * This file defines relations using the new v2 syntax which enables:
 * - Object-based `where` clauses in queries
 * - Many-to-many relations with `through`
 * - Predefined filters on relations
 *
 * Relations are incrementally migrated from v1 (in individual table files)
 * to v2 (here) as queries are updated.
 */
export const relations = defineRelations(schema, (r) => ({
  joinProfileRequests: {
    requestProfile: r.one.profiles({
      from: r.joinProfileRequests.requestProfileId,
      to: r.profiles.id,
      optional: false,
    }),
    targetProfile: r.one.profiles({
      from: r.joinProfileRequests.targetProfileId,
      to: r.profiles.id,
      optional: false,
    }),
  },
  users: {
    profile: r.one.profiles({
      from: r.users.profileId,
      to: r.profiles.id,
    }),
  },
  organizations: {
    profile: r.one.profiles({
      from: r.organizations.profileId,
      to: r.profiles.id,
      optional: false,
    }),
  },
  // Empty relations needed for v2 query API on tables without relations
  organizationUsers: {},
  accessRoles: {},
}));
