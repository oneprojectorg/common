import {
  ProposalReviewAssignmentStatus,
  ProposalReviewState,
  decisionProcesses,
  proposalHistory,
  proposalReviewAssignments,
  proposalReviews,
} from '@op/db/schema';
import { db, eq, sql } from '@op/db/test';

export interface ReviewSettings {
  reviewsPolicy: 'full_coverage';
  reviewsAllowRevisions: boolean;
  reviewsAnonymousFeedback: boolean;
}

export const defaultReviewSettings: ReviewSettings = {
  reviewsPolicy: 'full_coverage',
  reviewsAllowRevisions: true,
  reviewsAnonymousFeedback: true,
};

/** Enables review configuration on a decision process template. */
export async function configureProcessReviews(opts: {
  processId: string;
  settings?: ReviewSettings;
}): Promise<typeof decisionProcesses.$inferSelect> {
  const { processId, settings = defaultReviewSettings } = opts;

  const processRecord = await db.query.decisionProcesses.findFirst({
    where: {
      id: processId,
    },
  });

  if (!processRecord) {
    throw new Error(`Decision process not found: ${processId}`);
  }

  const [updatedProcess] = await db
    .update(decisionProcesses)
    .set({
      processSchema: {
        ...(processRecord.processSchema as Record<string, unknown>),
        config: settings,
      },
    })
    .where(eq(decisionProcesses.id, processId))
    .returning();

  if (!updatedProcess) {
    throw new Error(`Failed to configure reviews for process: ${processId}`);
  }

  return updatedProcess;
}

/** Returns the latest proposal history row ID for assigning reviews. */
export async function getLatestProposalHistoryId(opts: {
  proposalId: string;
}): Promise<string> {
  const latestHistory = await db.query.proposalHistory.findFirst({
    where: {
      id: opts.proposalId,
    },
    orderBy: {
      historyCreatedAt: 'desc',
    },
  });

  if (!latestHistory?.historyId) {
    throw new Error(
      `Expected proposal history row for proposal: ${opts.proposalId}`,
    );
  }

  return latestHistory.historyId;
}

/** Creates a synthetic proposal history snapshot for test fixtures. */
export async function createProposalHistorySnapshot(opts: {
  proposalId: string;
}): Promise<typeof proposalHistory.$inferSelect> {
  const proposalRecord = await db.query.proposals.findFirst({
    where: {
      id: opts.proposalId,
    },
  });

  if (!proposalRecord) {
    throw new Error(`Proposal not found: ${opts.proposalId}`);
  }

  const [historyRecord] = await db
    .insert(proposalHistory)
    .values({
      id: proposalRecord.id,
      processInstanceId: proposalRecord.processInstanceId,
      proposalData: proposalRecord.proposalData,
      status: proposalRecord.status,
      visibility: proposalRecord.visibility,
      submittedByProfileId: proposalRecord.submittedByProfileId,
      profileId: proposalRecord.profileId,
      lastEditedByProfileId: proposalRecord.lastEditedByProfileId,
      createdAt: proposalRecord.createdAt,
      updatedAt: proposalRecord.updatedAt,
      deletedAt: proposalRecord.deletedAt,
      validDuring: sql`tstzrange(now(), NULL)`,
    })
    .returning();

  if (!historyRecord) {
    throw new Error(
      `Failed to create proposal history snapshot for proposal: ${opts.proposalId}`,
    );
  }

  return historyRecord;
}

export interface CreateReviewAssignmentOptions {
  processInstanceId: string;
  proposalId: string;
  reviewerProfileId: string;
  phaseId?: string;
  assignedProposalHistoryId?: string | null;
  status?: ProposalReviewAssignmentStatus;
}

export interface CreateProposalReviewOptions {
  assignmentId: string;
  state?: ProposalReviewState;
  reviewData?: Record<string, unknown>;
  overallComment?: string | null;
  submittedAt?: string | null;
}

/** Creates a review assignment row for a proposal within a review phase. */
export async function createReviewAssignment(
  opts: CreateReviewAssignmentOptions,
): Promise<typeof proposalReviewAssignments.$inferSelect> {
  const {
    processInstanceId,
    proposalId,
    reviewerProfileId,
    phaseId = 'review',
    assignedProposalHistoryId = null,
    status = ProposalReviewAssignmentStatus.PENDING,
  } = opts;

  const [assignment] = await db
    .insert(proposalReviewAssignments)
    .values({
      processInstanceId,
      proposalId,
      reviewerProfileId,
      phaseId,
      assignedProposalHistoryId,
      status,
    })
    .returning();

  if (!assignment) {
    throw new Error(
      `Failed to create review assignment for proposal: ${proposalId}`,
    );
  }

  return assignment;
}

/** Creates a stored proposal review row for a review assignment. */
export async function createProposalReview(
  opts: CreateProposalReviewOptions,
): Promise<typeof proposalReviews.$inferSelect> {
  const {
    assignmentId,
    state = ProposalReviewState.DRAFT,
    reviewData = {},
    overallComment = null,
    submittedAt = null,
  } = opts;

  const [review] = await db
    .insert(proposalReviews)
    .values({
      assignmentId,
      state,
      reviewData,
      overallComment,
      submittedAt,
    })
    .returning();

  if (!review) {
    throw new Error(
      `Failed to create proposal review for assignment: ${assignmentId}`,
    );
  }

  return review;
}
