import {
  ProposalReviewAssignmentStatus,
  ProposalReviewRequestState,
  ProposalReviewState,
  ProposalStatus,
  categoryReviewers,
  decisionProcesses,
  proposalCategories,
  proposalReviewAssignments,
  proposalReviewRequests,
  proposalReviews,
  proposals,
  taxonomies,
  taxonomyTerms,
} from '@op/db/schema';
import { and, db, eq } from '@op/db/test';

import { type CreateProposalResult, createProposal } from './decision-data';

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

export interface CreateRevisionRequestOptions {
  assignmentId: string;
  state?: ProposalReviewRequestState;
  requestComment?: string;
  requestedProposalHistoryId?: string | null;
  respondedProposalHistoryId?: string | null;
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

export interface CreateReviewScenarioOptions {
  /** Decision instance the proposal lives in */
  instance: { id: string };
  /** Proposal author */
  author: {
    profileId: string;
    authUserId: string;
    email: string;
  };
  /** Reviewer assigned to the proposal */
  reviewer: { profileId: string };
  /** Proposal content — defaults to a minimal title-only payload */
  proposalData?: Parameters<typeof createProposal>[0]['proposalData'];
  /** Assignment status (defaults to PENDING) */
  assignmentStatus?: ProposalReviewAssignmentStatus;
  /** Phase ID the assignment belongs to (defaults to 'review') */
  phaseId?: string;
  /**
   * If provided, also create a revision request on the assignment.
   * Mirrors `CreateRevisionRequestOptions` minus assignmentId.
   */
  revisionRequest?: {
    state?: ProposalReviewRequestState;
    requestComment?: string;
    requestedProposalHistoryId?: string | null;
    respondedProposalHistoryId?: string | null;
  };
}

export interface CreateReviewScenarioResult {
  proposal: CreateProposalResult;
  assignedProposalHistoryId: string;
  assignment: typeof proposalReviewAssignments.$inferSelect;
  revisionRequest?: typeof proposalReviewRequests.$inferSelect;
}

/**
 * Composite helper that creates the full proposal → SUBMITTED → history →
 * review assignment chain (and optionally a revision request on top). The
 * AFTER UPDATE trigger on proposals writes a history row when the status
 * moves to SUBMITTED; we read the history ID back so the assignment is
 * anchored to a real snapshot.
 */
export async function createReviewScenario(
  opts: CreateReviewScenarioOptions,
): Promise<CreateReviewScenarioResult> {
  const proposal = await createProposal({
    processInstanceId: opts.instance.id,
    submittedByProfileId: opts.author.profileId,
    authUserId: opts.author.authUserId,
    email: opts.author.email,
    proposalData: opts.proposalData ?? { title: 'Community Garden Expansion' },
  });

  await db
    .update(proposals)
    .set({ status: ProposalStatus.SUBMITTED })
    .where(eq(proposals.id, proposal.id));
  proposal.status = ProposalStatus.SUBMITTED;

  const assignedProposalHistoryId = await getLatestProposalHistoryId({
    proposalId: proposal.id,
  });

  const assignment = await createReviewAssignment({
    processInstanceId: opts.instance.id,
    proposalId: proposal.id,
    reviewerProfileId: opts.reviewer.profileId,
    phaseId: opts.phaseId,
    assignedProposalHistoryId,
    status: opts.assignmentStatus ?? ProposalReviewAssignmentStatus.PENDING,
  });

  const revisionRequest = opts.revisionRequest
    ? await createRevisionRequest({
        assignmentId: assignment.id,
        state: opts.revisionRequest.state,
        requestComment: opts.revisionRequest.requestComment,
        requestedProposalHistoryId:
          opts.revisionRequest.requestedProposalHistoryId ?? null,
        respondedProposalHistoryId:
          opts.revisionRequest.respondedProposalHistoryId ?? null,
      })
    : undefined;

  return { proposal, assignedProposalHistoryId, assignment, revisionRequest };
}

/**
 * Category label → taxonomy term slug. Must match production's `categoryTermUri`
 * (slugify) for the ASCII labels the e2e suite uses so `getProcessCategories`
 * resolves the config category to the term this helper creates.
 */
export function categoryTermUri(label: string): string {
  return (
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      // Runs are already collapsed above, so a single leading/trailing dash is
      // all that can remain — strip it without a quantifier (avoids ReDoS).
      .replace(/^-|-$/g, '')
  );
}

export interface EnsuredCategoryTerm {
  label: string;
  taxonomyTermId: string;
}

/**
 * Ensures the shared "proposal" taxonomy exists and has a term for each label,
 * returning the term id per label. Mirrors production
 * `ensureProposalTaxonomyTerms`: terms are append-only and keyed on
 * `termUri`, so a term is reused across instances/runs (scope rows and
 * `proposalCategories` links are per-instance/per-proposal, so reuse is safe).
 */
export async function ensureProposalCategoryTerms(
  labels: string[],
): Promise<EnsuredCategoryTerm[]> {
  let proposalTaxonomy = await db.query.taxonomies.findFirst({
    where: { name: 'proposal' },
  });

  if (!proposalTaxonomy) {
    const [created] = await db
      .insert(taxonomies)
      .values({
        name: 'proposal',
        description:
          'Categories for organizing proposals in decision-making processes',
      })
      .onConflictDoNothing({ target: taxonomies.name })
      .returning();
    proposalTaxonomy =
      created ??
      (await db.query.taxonomies.findFirst({ where: { name: 'proposal' } }));
  }

  if (!proposalTaxonomy) {
    throw new Error('Failed to ensure "proposal" taxonomy');
  }

  const results: EnsuredCategoryTerm[] = [];
  for (const label of labels) {
    const termUri = categoryTermUri(label);

    // Insert-then-select is idempotent under the parallel workers that seed the
    // same labels concurrently (a check-then-insert would race the unique index).
    await db
      .insert(taxonomyTerms)
      .values({
        taxonomyId: proposalTaxonomy.id,
        termUri,
        label,
        definition: `Category for ${label} proposals`,
      })
      .onConflictDoNothing();

    const [term] = await db
      .select({ id: taxonomyTerms.id })
      .from(taxonomyTerms)
      .where(
        and(
          eq(taxonomyTerms.taxonomyId, proposalTaxonomy.id),
          eq(taxonomyTerms.termUri, termUri),
        ),
      );

    if (!term) {
      throw new Error(`Failed to ensure taxonomy term for category: ${label}`);
    }
    results.push({ label, taxonomyTermId: term.id });
  }

  return results;
}

/**
 * Tags a proposal with a submission category (a `proposalCategories` link),
 * mirroring what `setProposalCategories` writes in production. Idempotent.
 */
export async function addProposalToCategory(opts: {
  proposalId: string;
  taxonomyTermId: string;
}): Promise<void> {
  await db
    .insert(proposalCategories)
    .values({
      proposalId: opts.proposalId,
      taxonomyTermId: opts.taxonomyTermId,
    })
    .onConflictDoNothing();
}

export interface CreateCategoryReviewerOptions {
  processInstanceId: string;
  taxonomyTermId: string;
  reviewerProfileId: string;
  /** NULL (default) = instance-wide, matching the builder's assign-only write. */
  phaseId?: string | null;
}

/**
 * Inserts a by-category reviewer scope row (`decision_category_reviewers`),
 * mirroring the direct-DB path the by-category generation/reconcile tests use.
 * Idempotent via the unique (instance, term, reviewer, phase) index.
 */
export async function createCategoryReviewer(
  opts: CreateCategoryReviewerOptions,
): Promise<typeof categoryReviewers.$inferSelect> {
  const {
    processInstanceId,
    taxonomyTermId,
    reviewerProfileId,
    phaseId = null,
  } = opts;

  const [inserted] = await db
    .insert(categoryReviewers)
    .values({ processInstanceId, taxonomyTermId, reviewerProfileId, phaseId })
    .onConflictDoNothing()
    .returning();

  if (inserted) {
    return inserted;
  }

  const existing = await db.query.categoryReviewers.findFirst({
    where: {
      processInstanceId,
      taxonomyTermId,
      reviewerProfileId,
      phaseId: phaseId ?? { isNull: true },
    },
  });

  if (!existing) {
    throw new Error('Failed to create category reviewer scope row');
  }

  return existing;
}

/** Creates a revision request row for a review assignment. */
export async function createRevisionRequest(
  opts: CreateRevisionRequestOptions,
): Promise<typeof proposalReviewRequests.$inferSelect> {
  const {
    assignmentId,
    state = ProposalReviewRequestState.REQUESTED,
    requestComment = 'Please revise your proposal.',
    requestedProposalHistoryId = null,
    respondedProposalHistoryId = null,
  } = opts;

  const [request] = await db
    .insert(proposalReviewRequests)
    .values({
      assignmentId,
      state,
      requestComment,
      requestedProposalHistoryId,
      respondedProposalHistoryId,
    })
    .returning();

  if (!request) {
    throw new Error(
      `Failed to create revision request for assignment: ${assignmentId}`,
    );
  }

  return request;
}
