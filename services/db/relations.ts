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
   * Poll relations
   *
   * profileId and createdById are NOT NULL.
   */
  polls: {
    profile: r.one.profiles({
      from: r.polls.profileId,
      to: r.profiles.id,
      optional: false,
    }),
    createdBy: r.one.users({
      from: r.polls.createdById,
      to: r.users.id,
      optional: false,
    }),
    votes: r.many.pollVotes({
      from: r.polls.id,
      to: r.pollVotes.pollId,
    }),
  },

  /**
   * Poll vote relations
   *
   * pollId and userId are NOT NULL.
   */
  pollVotes: {
    poll: r.one.polls({
      from: r.pollVotes.pollId,
      to: r.polls.id,
      optional: false,
    }),
    user: r.one.users({
      from: r.pollVotes.userId,
      to: r.users.id,
      optional: false,
    }),
  },
}));
