import { sql } from 'drizzle-orm';
import {
  check,
  index,
  pgEnum,
  pgTable,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import {
  autoId,
  enumToPgEnum,
  serviceRolePolicies,
  timestamps,
} from '../../helpers';
import { profiles } from './profiles.sql';

export enum ProposalRelationshipType {
  // Read by `enumToPgEnum` below to build the Postgres type, which static
  // analysis can't see. No TypeScript caller yet — the services that write
  // merges land in a follow-up.
  // fallow-ignore-next-line unused-enum-member
  MERGED = 'merged',
}

export const proposalRelationshipTypeEnum = pgEnum(
  'decision_proposal_relationship_type',
  enumToPgEnum(ProposalRelationshipType),
);

/**
 * Directed edges between proposals, keyed on the profile each proposal owns
 * rather than on the `decision_proposals` row. Every proposal creates a profile
 * (`EntityType.PROPOSAL`) at submit time, and the profile is the root entity —
 * so relationships live at the profile level, the same level as
 * `profile_relationships`.
 *
 * Direction is always source -> target, read as "source is <relationship_type>
 * into target". Merging six proposals into a new one writes six rows: each
 * original proposal's profile is a source, the new proposal's profile is the
 * shared target.
 *
 * Kept separate from `profile_relationships` for the enum namespace — `merged`
 * shouldn't be a legal edge type between two organizations, and `following`
 * shouldn't be one here. The column shape is deliberately identical, so
 * folding the two together later is a rename plus an enum merge.
 *
 * The endpoints are NOT constrained to proposal-type profiles. That's
 * intentional: a person or an organization referencing a proposal is the same
 * shape of edge, and this table should be able to hold it.
 */
export const proposalRelationships = pgTable(
  'decision_proposal_relationships',
  {
    id: autoId().primaryKey(),
    sourceProfileId: uuid('source_profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    targetProfileId: uuid('target_profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    relationshipType:
      proposalRelationshipTypeEnum('relationship_type').notNull(),
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    // A profile linked to itself is meaningless and would render as its own
    // ancestor, so reject the pair at the database rather than in every caller.
    check(
      'proposal_relationships_no_self_link',
      sql`${table.sourceProfileId} <> ${table.targetProfileId}`,
    ),
    // Partial on purpose: the table soft-deletes, so a plain unique index would
    // permanently block re-linking a pair after it has been unlinked once.
    uniqueIndex('proposal_rel_source_target_type_unique')
      .on(table.sourceProfileId, table.targetProfileId, table.relationshipType)
      .where(sql`${table.deletedAt} IS NULL`),
    // Serves the merge read: given the merged proposal, list everything merged
    // into it. The unique index above already covers the source-leading side.
    index('proposal_rel_target_type_idx').on(
      table.targetProfileId,
      table.relationshipType,
    ),
  ],
);

export type ProposalRelationship = typeof proposalRelationships.$inferSelect;
