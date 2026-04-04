import {
  foreignKey,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import {
  autoId,
  enumToPgEnum,
  serviceRolePolicies,
  timestamps,
} from '../../helpers';
import { processInstances } from './processInstances.sql';
import { profiles } from './profiles.sql';
import { proposalHistory } from './proposalHistory.sql';
import { proposals } from './proposals.sql';

export enum ProposalReviewAssignmentStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  AWAITING_AUTHOR_REVISION = 'awaiting_author_revision',
  READY_FOR_RE_REVIEW = 'ready_for_re_review',
  COMPLETED = 'completed',
}

export const proposalReviewAssignmentStatusEnum = pgEnum(
  'decision_proposal_review_assignment_status',
  enumToPgEnum(ProposalReviewAssignmentStatus),
);

export enum ProposalReviewRequestState {
  REQUESTED = 'requested',
  RESUBMITTED = 'resubmitted',
  RESOLVED = 'resolved',
  CANCELLED = 'cancelled',
}

export const proposalReviewRequestStateEnum = pgEnum(
  'decision_proposal_review_request_state',
  enumToPgEnum(ProposalReviewRequestState),
);

export enum ProposalReviewState {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
}

export const proposalReviewStateEnum = pgEnum(
  'decision_proposal_review_state',
  enumToPgEnum(ProposalReviewState),
);

/**
 * Review queue rows for a reviewer and proposal within a phase.
 */
export const proposalReviewAssignments = pgTable(
  'decision_proposal_review_assignments',
  {
    id: autoId().primaryKey(),

    processInstanceId: uuid('process_instance_id')
      .notNull()
      .references(() => processInstances.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),

    proposalId: uuid('proposal_id')
      .notNull()
      .references(() => proposals.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),

    reviewerProfileId: uuid('reviewer_profile_id')
      .notNull()
      .references(() => profiles.id, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),

    phaseId: varchar('phase_id', { length: 256 }).notNull(),

    assignedProposalHistoryId: uuid('assigned_proposal_history_id'),

    status: proposalReviewAssignmentStatusEnum('status')
      .notNull()
      .default(ProposalReviewAssignmentStatus.PENDING),

    assignedAt: timestamp('assigned_at', {
      withTimezone: true,
      mode: 'string',
    }).defaultNow(),
    completedAt: timestamp('completed_at', {
      withTimezone: true,
      mode: 'string',
    }),

    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    foreignKey({
      name: 'proposal_review_assignments_assigned_history_fkey',
      columns: [
        table.processInstanceId,
        table.proposalId,
        table.assignedProposalHistoryId,
      ],
      foreignColumns: [
        proposalHistory.processInstanceId,
        proposalHistory.id,
        proposalHistory.historyId,
      ],
    })
      .onUpdate('cascade')
      .onDelete('set null'),
    unique('proposal_review_assignments_unique').on(
      table.processInstanceId,
      table.proposalId,
      table.reviewerProfileId,
      table.phaseId,
    ),
    index('proposal_review_assignments_process_idx').on(
      table.processInstanceId,
    ),
    index('proposal_review_assignments_proposal_idx').on(table.proposalId),
    index('proposal_review_assignments_reviewer_status_idx').on(
      table.reviewerProfileId,
      table.status,
    ),
  ],
);

/**
 * Author-visible feedback and revision-request workflow rows.
 */
export const proposalReviewRequests = pgTable(
  'decision_proposal_review_requests',
  {
    id: autoId().primaryKey(),

    assignmentId: uuid('assignment_id').notNull(),

    state: proposalReviewRequestStateEnum('state')
      .notNull()
      .default(ProposalReviewRequestState.REQUESTED),

    requestComment: text('request_comment').notNull(),

    requestedProposalHistoryId: uuid('requested_proposal_history_id'),

    respondedProposalHistoryId: uuid('responded_proposal_history_id'),

    requestedAt: timestamp('requested_at', {
      withTimezone: true,
      mode: 'string',
    }).defaultNow(),
    respondedAt: timestamp('responded_at', {
      withTimezone: true,
      mode: 'string',
    }),
    resolvedAt: timestamp('resolved_at', {
      withTimezone: true,
      mode: 'string',
    }),

    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    foreignKey({
      name: 'decision_proposal_review_requests_F9cAdsDbCl19_fkey',
      columns: [table.assignmentId],
      foreignColumns: [proposalReviewAssignments.id],
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
    foreignKey({
      name: 'proposal_review_requests_requested_history_fkey',
      columns: [table.requestedProposalHistoryId],
      foreignColumns: [proposalHistory.historyId],
    })
      .onUpdate('cascade')
      .onDelete('set null'),
    foreignKey({
      name: 'proposal_review_requests_responded_history_fkey',
      columns: [table.respondedProposalHistoryId],
      foreignColumns: [proposalHistory.historyId],
    })
      .onUpdate('cascade')
      .onDelete('set null'),
    index('proposal_review_requests_assignment_idx').on(table.assignmentId),
    index('proposal_review_requests_process_state_idx').on(table.state),
  ],
);

/**
 * Rubric-based evaluation rows for a reviewer and proposal within a phase.
 */
export const proposalReviews = pgTable(
  'decision_proposal_reviews',
  {
    id: autoId().primaryKey(),

    assignmentId: uuid('assignment_id').notNull(),

    state: proposalReviewStateEnum('state')
      .notNull()
      .default(ProposalReviewState.DRAFT),

    reviewData: jsonb('review_data').$type<Record<string, unknown>>().notNull(),
    overallComment: text('overall_comment'),
    submittedAt: timestamp('submitted_at', {
      withTimezone: true,
      mode: 'string',
    }),

    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    foreignKey({
      name: 'decision_proposal_reviews_h6ugwYZ5rEL1_fkey',
      columns: [table.assignmentId],
      foreignColumns: [proposalReviewAssignments.id],
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
    unique('proposal_reviews_assignment_unique').on(table.assignmentId),
    index('proposal_reviews_process_state_idx').on(table.state),
  ],
);

export type ProposalReviewAssignment =
  typeof proposalReviewAssignments.$inferSelect;
export type ProposalReviewRequest = typeof proposalReviewRequests.$inferSelect;
export type ProposalReview = typeof proposalReviews.$inferSelect;
