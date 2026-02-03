/**
 * Drizzle Relations v2 definitions
 *
 * Single source of truth for v2 relational query relations.
 * Relations are defined here using `defineRelations`.
 *
 * Note: v1 relations still exist in individual *.sql.ts files for `db._query`.
 * This file is for the new `db.query` API.
 *
 * @see https://orm.drizzle.team/docs/relations-v1-v2
 */
import { defineRelations } from 'drizzle-orm';

import * as schema from './schema';

export const relations = defineRelations(schema, (r) => ({
  /**
   * Proposal relations
   *
   * processInstanceId, submittedByProfileId, and profileId are NOT NULL,
   * so we mark them as optional: false.
   */
  proposals: {
    processInstance: r.one.processInstances({
      from: r.proposals.processInstanceId,
      to: r.processInstances.id,
      optional: false,
    }),
    submittedBy: r.one.profiles({
      from: r.proposals.submittedByProfileId,
      to: r.profiles.id,
      alias: 'proposal_submittedBy',
      optional: false,
    }),
    profile: r.one.profiles({
      from: r.proposals.profileId,
      to: r.profiles.id,
      alias: 'proposal_profile',
      optional: false,
    }),
  },

  /**
   * Profile relations
   *
   * avatarImageId and headerImageId are nullable.
   */
  profiles: {
    avatarImage: r.one.objectsInStorage({
      from: r.profiles.avatarImageId,
      to: r.objectsInStorage.id,
    }),
    headerImage: r.one.objectsInStorage({
      from: r.profiles.headerImageId,
      to: r.objectsInStorage.id,
    }),
  },

  /**
   * Profile invites relations
   *
   * profileId, accessRoleId, and invitedBy are NOT NULL.
   */
  profileInvites: {
    profile: r.one.profiles({
      from: r.profileInvites.profileId,
      to: r.profiles.id,
      optional: false,
    }),
    accessRole: r.one.accessRoles({
      from: r.profileInvites.accessRoleId,
      to: r.accessRoles.id,
      optional: false,
    }),
    inviter: r.one.profiles({
      from: r.profileInvites.invitedBy,
      to: r.profiles.id,
      alias: 'profileInvite_inviter',
      optional: false,
    }),
  },
}));
