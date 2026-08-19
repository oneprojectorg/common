import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
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
import { proposals } from './proposals.sql';

export enum ProposalRelationshipType {
  MERGED = 'merged',
}

export const proposalRelationshipTypeEnum = pgEnum(
  'decision_proposal_relationship_type',
  enumToPgEnum(ProposalRelationshipType),
);

/**
 * Directed edges between proposals within one decision. Direction is always
 * source -> target, read as "source is <relationship_type> into target". Merging
 * six proposals into a new one writes six rows sharing a target.
 *
 * `process_instance_id` is denormalized from the proposals so reads that exclude
 * merged-away proposals can be scoped to one decision — unscoped, that anti-join
 * consults every merge in the table. Composite foreign keys on
 * `(process_instance_id, source_proposal_id)` and
 * `(process_instance_id, target_proposal_id)` make that denormalization
 * self-enforcing and additionally make a cross-decision edge unrepresentable.
 *
 * Kept separate from `profile_relationships` because that table is a social
 * graph between profiles: `merged` isn't a legal edge between two organizations,
 * it hard-deletes behind a plain unique index where these soft-delete behind a
 * partial one, and its endpoints are profiles rather than proposals.
 *
 * A live `merged` edge is the only record that a proposal was superseded; there
 * is deliberately no mirroring flag on `decision_proposals`.
 */
export const proposalRelationships = pgTable(
  'decision_proposal_relationships',
  {
    id: autoId().primaryKey(),
    processInstanceId: uuid('process_instance_id').notNull(),
    sourceProposalId: uuid('source_proposal_id').notNull(),
    targetProposalId: uuid('target_proposal_id').notNull(),
    // `$type` only narrows the TypeScript side — `enumToPgEnum` widens the
    // generated column type to `string`, and this is the single boundary where
    // it's pinned back to the enum so no consumer has to cast.
    relationshipType: proposalRelationshipTypeEnum('relationship_type')
      .$type<ProposalRelationshipType>()
      .notNull(),
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    // Both ends must be proposals in the edge's own decision. The pair
    // referenced here is `proposals_process_instance_uniq`, which exists for
    // exactly this (`decision_transition_proposals` uses it the same way).
    foreignKey({
      name: 'proposal_rel_source_fkey',
      columns: [table.processInstanceId, table.sourceProposalId],
      foreignColumns: [proposals.processInstanceId, proposals.id],
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
    foreignKey({
      name: 'proposal_rel_target_fkey',
      columns: [table.processInstanceId, table.targetProposalId],
      foreignColumns: [proposals.processInstanceId, proposals.id],
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
    // The index and constraint names differ from the profile-keyed originals on
    // purpose: same-name redefinitions make drizzle emit the DROP after the
    // column drops that already removed them, which fails.
    //
    // A proposal linked to itself is meaningless and would render as its own
    // ancestor, so reject the pair at the database rather than in every caller.
    check(
      'proposal_rel_no_self_link',
      sql`${table.sourceProposalId} <> ${table.targetProposalId}`,
    ),
    // Partial on purpose: the table soft-deletes, so a plain unique index would
    // permanently block re-linking a pair after it has been unlinked once.
    uniqueIndex('proposal_rel_pair_type_unique')
      .on(
        table.sourceProposalId,
        table.targetProposalId,
        table.relationshipType,
      )
      .where(sql`${table.deletedAt} IS NULL`),
    // Serves the merge read: given the surviving proposal, list everything
    // merged into it.
    index('proposal_rel_target_proposal_type_idx').on(
      table.targetProposalId,
      table.relationshipType,
    ),
    // Enforces "superseded at most once per decision" and serves the
    // supersession read. Scoped to `merged` so other types may fan out.
    uniqueIndex('proposal_rel_instance_source_merged_unique')
      .on(table.processInstanceId, table.sourceProposalId)
      .where(
        sql`${table.relationshipType} = 'merged' AND ${table.deletedAt} IS NULL`,
      ),
  ],
);

export type ProposalRelationship = typeof proposalRelationships.$inferSelect;
