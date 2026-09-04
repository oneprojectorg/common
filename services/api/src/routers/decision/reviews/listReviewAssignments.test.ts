import { mockCollab } from '@op/collab/testing';
import type {
  DecisionSchemaDefinition,
  RubricTemplateSchema,
} from '@op/common';
import {
  ProposalRelationshipType,
  ProposalReviewAssignmentStatus,
  ProposalReviewRequestState,
  ProposalReviewState,
  proposalCategories,
  proposalRelationships,
  taxonomyTerms,
} from '@op/db/schema';
import { db } from '@op/db/test';
import {
  createProposalReview,
  createReviewAssignment as createReviewAssignmentRow,
  createRevisionRequest,
} from '@op/test';
import { inArray } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { TestReviewsDataManager } from '../../../test/helpers/TestReviewsDataManager';
import {
  accessTierGatingCell,
  describeDecisionAccessTierGating,
  expectFailsAccessTierGate,
} from '../../../test/helpers/gating/decision';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../../test/supabase-utils';
import { createCallerFactory } from '../../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

const rubricTemplate: RubricTemplateSchema = {
  type: 'object',
  'x-field-order': ['impact'],
  properties: {
    impact: {
      type: 'integer',
      title: 'Impact',
      'x-format': 'dropdown',
      minimum: 1,
      maximum: 5,
      oneOf: [
        { const: 1, title: 'Low' },
        { const: 5, title: 'High' },
      ],
    },
  },
  required: ['impact'],
};

/** Phase the fixtures pin assignments to (`createReviewScenario`'s default). */
const REVIEW_PHASE = 'review';

const FEASIBILITY_PHASE = 'feasibility';
const COMMUNITY_PHASE = 'community';

const twoReviewPhaseSchema = {
  id: 'two-review-phases',
  version: '1.0.0',
  name: 'Two Review Phases',
  description: 'Feasibility review followed by a community review.',
  phases: [
    {
      id: 'submission',
      name: 'Proposal Submission',
      rules: {
        proposals: { submit: true },
        advancement: { method: 'date' as const, endDate: '2026-01-01' },
      },
    },
    {
      id: FEASIBILITY_PHASE,
      name: 'Feasibility Review',
      rules: {
        reviews: { submit: true },
        advancement: { method: 'date' as const, endDate: '2026-01-02' },
      },
    },
    {
      id: COMMUNITY_PHASE,
      name: 'Community Review',
      rules: {
        reviews: { submit: true },
        advancement: { method: 'date' as const, endDate: '2026-01-03' },
      },
    },
  ],
} satisfies DecisionSchemaDefinition;

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

/** The default context starts on `'submission'`; the queue reads the current phase. */
async function createReviewPhaseContext(testData: TestReviewsDataManager) {
  const context = await testData.createContext();
  await testData.setCurrentPhase(context.instance.instance.id, REVIEW_PHASE);
  return context;
}

/** Two-review-phase instance sitting on the second (community) review phase. */
async function createTwoReviewPhaseContext(testData: TestReviewsDataManager) {
  const context = await testData.createContext({
    processSchema: twoReviewPhaseSchema,
  });
  await testData.setCurrentPhase(context.instance.instance.id, COMMUNITY_PHASE);
  return context;
}

async function attachCategoryToProposal({
  proposalId,
  label,
}: {
  proposalId: string;
  label: string;
}) {
  const [term] = await db
    .insert(taxonomyTerms)
    .values({
      termUri: `${label.toLowerCase()}-${proposalId}`,
      label,
    })
    .returning();
  if (!term) {
    throw new Error('failed to create taxonomy term');
  }

  await db
    .insert(proposalCategories)
    .values({ proposalId, taxonomyTermId: term.id });

  return term;
}

function seedMockCollab(collaborationDocId: string) {
  mockCollab.setDocResponse(collaborationDocId, {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Community garden proposal content' }],
      },
    ],
  });
}

/**
 * Seeds the mock collab doc for a created proposal, narrowing `proposalData`
 * instead of asserting its shape.
 */
function seedProposalCollab(proposal: { proposalData: unknown }) {
  const data = proposal.proposalData;
  if (
    typeof data !== 'object' ||
    data === null ||
    !('collaborationDocId' in data) ||
    typeof data.collaborationDocId !== 'string'
  ) {
    throw new Error('proposal has no collaborationDocId');
  }

  seedMockCollab(data.collaborationDocId);
}

describe.concurrent('listReviewAssignments', () => {
  it('returns the assignment using the live proposal when no history snapshot exists', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      context: await createReviewPhaseContext(testData),
      title: 'Live Proposal Review',
    });

    const { collaborationDocId } = created.proposal.proposalData as {
      collaborationDocId: string;
    };
    seedMockCollab(collaborationDocId);

    const reviewerCaller = await createAuthenticatedCaller(
      created.reviewer.email,
    );
    const result = await reviewerCaller.decision.listReviewAssignments({
      processInstanceId: created.context.instance.instance.id,
    });

    expect(result.assignments).toHaveLength(1);
    expect(result.assignments[0]).toMatchObject({
      assignment: {
        id: created.assignment.id,
        proposal: {
          id: created.proposal.id,
        },
      },
    });
  });

  it('returns all assignments for the reviewer in the current phase', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const first = await testData.createReviewAssignment({
      context: await createReviewPhaseContext(testData),
      title: 'Community Garden Expansion',
    });

    const second = await testData.createReviewAssignment({
      context: first.context,
      reviewer: first.reviewer,
      title: 'Youth Arts Festival',
    });

    const { collaborationDocId: docId1 } = first.proposal.proposalData as {
      collaborationDocId: string;
    };
    const { collaborationDocId: docId2 } = second.proposal.proposalData as {
      collaborationDocId: string;
    };
    seedMockCollab(docId1);
    seedMockCollab(docId2);

    const reviewerCaller = await createAuthenticatedCaller(
      first.reviewer.email,
    );
    const result = await reviewerCaller.decision.listReviewAssignments({
      processInstanceId: first.context.instance.instance.id,
    });

    expect(result.assignments).toHaveLength(2);
    expect(result.assignments.map((a) => a.assignment.id)).toEqual(
      expect.arrayContaining([first.assignment.id, second.assignment.id]),
    );
  });

  it('includes rubric template and review data per assignment', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      context: await createReviewPhaseContext(testData),
      title: 'Community Garden Expansion',
    });

    const { collaborationDocId } = created.proposal.proposalData as {
      collaborationDocId: string;
    };
    seedMockCollab(collaborationDocId);

    await Promise.all([
      testData.setRubricTemplate(created.context, rubricTemplate),
      createProposalReview({
        assignmentId: created.assignment.id,
        state: ProposalReviewState.DRAFT,
        reviewData: {
          answers: { impact: 5 },
          rationales: { impact: 'Strong fit' },
        },
        overallComment: 'Promising proposal',
      }),
    ]);

    const reviewerCaller = await createAuthenticatedCaller(
      created.reviewer.email,
    );
    const result = await reviewerCaller.decision.listReviewAssignments({
      processInstanceId: created.context.instance.instance.id,
    });

    expect(result.assignments).toHaveLength(1);
    expect(result.assignments[0]).toMatchObject({
      assignment: {
        id: created.assignment.id,
        status: ProposalReviewAssignmentStatus.PENDING,
        proposal: {
          id: created.proposal.id,
        },
      },
      rubricTemplate,
      review: {
        assignmentId: created.assignment.id,
        state: ProposalReviewState.DRAFT,
        reviewData: {
          answers: { impact: 5 },
          rationales: { impact: 'Strong fit' },
        },
        overallComment: 'Promising proposal',
      },
      revisionRequest: null,
    });
  });

  it('includes revision request when one exists for an assignment', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      context: await createReviewPhaseContext(testData),
      title: 'Needs Revision',
      status: ProposalReviewAssignmentStatus.AWAITING_AUTHOR_REVISION,
    });

    const { collaborationDocId } = created.proposal.proposalData as {
      collaborationDocId: string;
    };
    seedMockCollab(collaborationDocId);

    const revisionRequest = await createRevisionRequest({
      assignmentId: created.assignment.id,
      requestComment: 'Missing budget breakdown.',
    });

    const reviewerCaller = await createAuthenticatedCaller(
      created.reviewer.email,
    );
    const result = await reviewerCaller.decision.listReviewAssignments({
      processInstanceId: created.context.instance.instance.id,
    });

    expect(result.assignments).toHaveLength(1);
    expect(result.assignments[0]).toMatchObject({
      assignment: {
        id: created.assignment.id,
        status: ProposalReviewAssignmentStatus.AWAITING_AUTHOR_REVISION,
      },
      revisionRequest: {
        id: revisionRequest.id,
        assignmentId: created.assignment.id,
        state: ProposalReviewRequestState.REQUESTED,
        requestComment: 'Missing budget breakdown.',
      },
    });
  });

  it('orders by least reviewed — fewest completed reviews across all reviewers first', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);

    // Three proposals assigned to the same reviewer, all pending for them.
    const zero = await testData.createReviewAssignment({
      context: await createReviewPhaseContext(testData),
      title: 'Zero completed reviews',
    });
    const context = zero.context;
    const reviewer = zero.reviewer;
    const one = await testData.createReviewAssignment({
      context,
      reviewer,
      title: 'One completed review',
    });
    const two = await testData.createReviewAssignment({
      context,
      reviewer,
      title: 'Two completed reviews',
    });

    for (const created of [zero, one, two]) {
      const { collaborationDocId } = created.proposal.proposalData as {
        collaborationDocId: string;
      };
      seedMockCollab(collaborationDocId);
    }

    // Other reviewers complete some proposals so their coverage differs.
    const otherA = await testData.createReviewer(context);
    const otherB = await testData.createReviewer(context);
    const instanceId = context.instance.instance.id;
    await createReviewAssignmentRow({
      processInstanceId: instanceId,
      proposalId: one.proposal.id,
      reviewerProfileId: otherA.profileId,
      status: ProposalReviewAssignmentStatus.COMPLETED,
    });
    await createReviewAssignmentRow({
      processInstanceId: instanceId,
      proposalId: two.proposal.id,
      reviewerProfileId: otherA.profileId,
      status: ProposalReviewAssignmentStatus.COMPLETED,
    });
    await createReviewAssignmentRow({
      processInstanceId: instanceId,
      proposalId: two.proposal.id,
      reviewerProfileId: otherB.profileId,
      status: ProposalReviewAssignmentStatus.COMPLETED,
    });

    const reviewerCaller = await createAuthenticatedCaller(reviewer.email);
    const result = await reviewerCaller.decision.listReviewAssignments({
      processInstanceId: instanceId,
      sort: 'leastReviewed',
    });

    expect(result.assignments.map((a) => a.assignment.proposal.id)).toEqual([
      zero.proposal.id,
      one.proposal.id,
      two.proposal.id,
    ]);
  });

  it('surfaces the reviewer’s in-progress assignment first within an equal review-count bucket', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);

    const pending = await testData.createReviewAssignment({
      context: await createReviewPhaseContext(testData),
      title: 'Not started',
    });
    const context = pending.context;
    const reviewer = pending.reviewer;
    const inProgress = await testData.createReviewAssignment({
      context,
      reviewer,
      title: 'Picked up',
      status: ProposalReviewAssignmentStatus.IN_PROGRESS,
    });

    for (const created of [pending, inProgress]) {
      const { collaborationDocId } = created.proposal.proposalData as {
        collaborationDocId: string;
      };
      seedMockCollab(collaborationDocId);
    }

    const reviewerCaller = await createAuthenticatedCaller(reviewer.email);
    const result = await reviewerCaller.decision.listReviewAssignments({
      processInstanceId: context.instance.instance.id,
      sort: 'leastReviewed',
    });

    // Both proposals have zero completed reviews, so the in-progress one wins
    // the tiebreak and leads the list.
    expect(result.assignments[0]?.assignment.proposal.id).toBe(
      inProgress.proposal.id,
    );
  });

  it('lists every phase when phaseId is omitted and scopes to an explicit one', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await createTwoReviewPhaseContext(testData);

    // One reviewer, one proposal, an assignment in each review phase.
    const feasibility = await testData.createReviewAssignment({
      context,
      title: 'Reviewed in both phases',
      phaseId: FEASIBILITY_PHASE,
      status: ProposalReviewAssignmentStatus.COMPLETED,
    });
    const communityAssignment = await createReviewAssignmentRow({
      processInstanceId: context.instance.instance.id,
      proposalId: feasibility.proposal.id,
      reviewerProfileId: feasibility.reviewer.profileId,
      phaseId: COMMUNITY_PHASE,
    });

    const { collaborationDocId } = feasibility.proposal.proposalData as {
      collaborationDocId: string;
    };
    seedMockCollab(collaborationDocId);

    const reviewerCaller = await createAuthenticatedCaller(
      feasibility.reviewer.email,
    );

    // No phaseId — the instance sits on the community phase, but both
    // assignments come back.
    const everyPhase = await reviewerCaller.decision.listReviewAssignments({
      processInstanceId: context.instance.instance.id,
    });
    expect(everyPhase.assignments.map((a) => a.assignment.id).sort()).toEqual(
      [communityAssignment.id, feasibility.assignment.id].sort(),
    );

    // Each phase resolves on its own when asked for explicitly.
    const past = await reviewerCaller.decision.listReviewAssignments({
      processInstanceId: context.instance.instance.id,
      phaseId: FEASIBILITY_PHASE,
    });
    expect(past.assignments.map((a) => a.assignment.id)).toEqual([
      feasibility.assignment.id,
    ]);

    const current = await reviewerCaller.decision.listReviewAssignments({
      processInstanceId: context.instance.instance.id,
      phaseId: COMMUNITY_PHASE,
    });
    expect(current.assignments.map((a) => a.assignment.id)).toEqual([
      communityAssignment.id,
    ]);
  });

  it('counts only the scoped phase’s completed reviews for the least-reviewed sort', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await createTwoReviewPhaseContext(testData);
    const instanceId = context.instance.instance.id;

    const coveredNow = await testData.createReviewAssignment({
      context,
      title: 'One completed review this phase',
      phaseId: COMMUNITY_PHASE,
    });
    const reviewer = coveredNow.reviewer;
    const coveredBefore = await testData.createReviewAssignment({
      context,
      reviewer,
      title: 'Two completed reviews last phase',
      phaseId: COMMUNITY_PHASE,
    });

    for (const created of [coveredNow, coveredBefore]) {
      const { collaborationDocId } = created.proposal.proposalData as {
        collaborationDocId: string;
      };
      seedMockCollab(collaborationDocId);
    }

    const otherA = await testData.createReviewer(context);
    const otherB = await testData.createReviewer(context);
    await createReviewAssignmentRow({
      processInstanceId: instanceId,
      proposalId: coveredNow.proposal.id,
      reviewerProfileId: otherA.profileId,
      phaseId: COMMUNITY_PHASE,
      status: ProposalReviewAssignmentStatus.COMPLETED,
    });
    await createReviewAssignmentRow({
      processInstanceId: instanceId,
      proposalId: coveredBefore.proposal.id,
      reviewerProfileId: otherA.profileId,
      phaseId: FEASIBILITY_PHASE,
      status: ProposalReviewAssignmentStatus.COMPLETED,
    });
    await createReviewAssignmentRow({
      processInstanceId: instanceId,
      proposalId: coveredBefore.proposal.id,
      reviewerProfileId: otherB.profileId,
      phaseId: FEASIBILITY_PHASE,
      status: ProposalReviewAssignmentStatus.COMPLETED,
    });

    const reviewerCaller = await createAuthenticatedCaller(reviewer.email);
    const result = await reviewerCaller.decision.listReviewAssignments({
      processInstanceId: instanceId,
      phaseId: COMMUNITY_PHASE,
      sort: 'leastReviewed',
    });

    // Coverage counts within the scoped phase, so the proposal whose two
    // completions sit in the feasibility phase leads with zero.
    expect(result.assignments.map((a) => a.assignment.proposal.id)).toEqual([
      coveredBefore.proposal.id,
      coveredNow.proposal.id,
    ]);
  });

  it('filters assignments by category, matching any of the requested categories', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const inDistrictOne = await testData.createReviewAssignment({
      context: await createReviewPhaseContext(testData),
      title: 'District 1 proposal',
    });
    const inDistrictTwo = await testData.createReviewAssignment({
      context: inDistrictOne.context,
      reviewer: inDistrictOne.reviewer,
      title: 'District 2 proposal',
    });
    const uncategorized = await testData.createReviewAssignment({
      context: inDistrictOne.context,
      reviewer: inDistrictOne.reviewer,
      title: 'Uncategorized proposal',
    });

    for (const created of [inDistrictOne, inDistrictTwo, uncategorized]) {
      const { collaborationDocId } = created.proposal.proposalData as {
        collaborationDocId: string;
      };
      seedMockCollab(collaborationDocId);
    }

    const [termOne, termTwo] = await Promise.all([
      attachCategoryToProposal({
        proposalId: inDistrictOne.proposal.id,
        label: 'District 1',
      }),
      attachCategoryToProposal({
        proposalId: inDistrictTwo.proposal.id,
        label: 'District 2',
      }),
    ]);
    // proposalCategories cascades on taxonomyTerms delete, so cleaning up the
    // terms cleans up the join rows too.
    onTestFinished(async () => {
      await db
        .delete(taxonomyTerms)
        .where(inArray(taxonomyTerms.id, [termOne.id, termTwo.id]));
    });

    const reviewerCaller = await createAuthenticatedCaller(
      inDistrictOne.reviewer.email,
    );

    const single = await reviewerCaller.decision.listReviewAssignments({
      processInstanceId: inDistrictOne.context.instance.instance.id,
      categoryIds: [termOne.id],
    });

    expect(single.assignments).toHaveLength(1);
    expect(single.assignments[0]?.assignment.proposal.id).toBe(
      inDistrictOne.proposal.id,
    );

    // Multiple categories OR together — the uncategorized proposal stays out.
    const multiple = await reviewerCaller.decision.listReviewAssignments({
      processInstanceId: inDistrictOne.context.instance.instance.id,
      categoryIds: [termOne.id, termTwo.id],
    });

    expect(
      multiple.assignments.map((a) => a.assignment.proposal.id).sort(),
    ).toEqual([inDistrictOne.proposal.id, inDistrictTwo.proposal.id].sort());
  });

  it('returns empty list when the category matches no proposals', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      context: await createReviewPhaseContext(testData),
      title: 'Uncategorized proposal',
    });

    const { collaborationDocId } = created.proposal.proposalData as {
      collaborationDocId: string;
    };
    seedMockCollab(collaborationDocId);

    const reviewerCaller = await createAuthenticatedCaller(
      created.reviewer.email,
    );
    const result = await reviewerCaller.decision.listReviewAssignments({
      processInstanceId: created.context.instance.instance.id,
      categoryIds: [crypto.randomUUID()],
    });

    expect(result.assignments).toHaveLength(0);
  });

  it('filters assignments to a single proposal by its profile id', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const target = await testData.createReviewAssignment({
      context: await createReviewPhaseContext(testData),
      title: 'The proposal under review',
    });
    const context = target.context;
    const reviewer = target.reviewer;
    const other = await testData.createReviewAssignment({
      context,
      reviewer,
      title: 'Another proposal',
    });

    for (const created of [target, other]) {
      seedProposalCollab(created.proposal);
    }

    // A second reviewer on the same proposal — their assignment must stay out.
    const otherReviewer = await testData.createReviewer(context);
    await createReviewAssignmentRow({
      processInstanceId: context.instance.instance.id,
      proposalId: target.proposal.id,
      reviewerProfileId: otherReviewer.profileId,
      phaseId: REVIEW_PHASE,
    });

    const reviewerCaller = await createAuthenticatedCaller(reviewer.email);
    const result = await reviewerCaller.decision.listReviewAssignments({
      processInstanceId: context.instance.instance.id,
      proposalProfileId: target.proposal.profileId,
    });

    expect(result.assignments.map((a) => a.assignment.id)).toEqual([
      target.assignment.id,
    ]);
  });

  it('includes an earlier phase’s assignments for a proposal when phaseId is omitted', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await createTwoReviewPhaseContext(testData);

    // The instance sits on the community phase; the assignment is pinned to the
    // feasibility phase it was created in.
    const feasibility = await testData.createReviewAssignment({
      context,
      title: 'Reviewed in the earlier phase',
      phaseId: FEASIBILITY_PHASE,
    });

    seedProposalCollab(feasibility.proposal);

    const reviewerCaller = await createAuthenticatedCaller(
      feasibility.reviewer.email,
    );

    const everyPhase = await reviewerCaller.decision.listReviewAssignments({
      processInstanceId: context.instance.instance.id,
      proposalProfileId: feasibility.proposal.profileId,
    });
    expect(everyPhase.assignments.map((a) => a.assignment.id)).toEqual([
      feasibility.assignment.id,
    ]);

    // The proposal filter composes with an explicit phase, which scopes it out.
    const otherPhase = await reviewerCaller.decision.listReviewAssignments({
      processInstanceId: context.instance.instance.id,
      proposalProfileId: feasibility.proposal.profileId,
      phaseId: COMMUNITY_PHASE,
    });
    expect(otherPhase.assignments).toHaveLength(0);
  });

  it('orders a proposal’s assignments newest first, so the latest one leads', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await createTwoReviewPhaseContext(testData);

    // Same reviewer, same proposal, one assignment per review phase — what the
    // proposal-keyed review screen resolves against.
    const feasibility = await testData.createReviewAssignment({
      context,
      title: 'Reviewed in both phases',
      phaseId: FEASIBILITY_PHASE,
      assignedAt: '2026-01-01T00:00:00.000Z',
    });
    const community = await createReviewAssignmentRow({
      processInstanceId: context.instance.instance.id,
      proposalId: feasibility.proposal.id,
      reviewerProfileId: feasibility.reviewer.profileId,
      phaseId: COMMUNITY_PHASE,
      assignedAt: '2026-02-01T00:00:00.000Z',
    });

    seedProposalCollab(feasibility.proposal);

    const reviewerCaller = await createAuthenticatedCaller(
      feasibility.reviewer.email,
    );
    const result = await reviewerCaller.decision.listReviewAssignments({
      processInstanceId: context.instance.instance.id,
      proposalProfileId: feasibility.proposal.profileId,
      sort: 'newest',
    });

    expect(result.assignments.map((a) => a.assignment.id)).toEqual([
      community.id,
      feasibility.assignment.id,
    ]);
  });

  it('breaks an assignedAt tie by id, keeping the newest sort deterministic', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await createTwoReviewPhaseContext(testData);

    // A single batch insert stamps the same `assignedAt` on every row, so the
    // tie-break is what keeps the "latest" pick stable across refetches.
    const assignedAt = '2026-03-01T00:00:00.000Z';
    const feasibility = await testData.createReviewAssignment({
      context,
      title: 'Assigned in one batch',
      phaseId: FEASIBILITY_PHASE,
      assignedAt,
    });
    const community = await createReviewAssignmentRow({
      processInstanceId: context.instance.instance.id,
      proposalId: feasibility.proposal.id,
      reviewerProfileId: feasibility.reviewer.profileId,
      phaseId: COMMUNITY_PHASE,
      assignedAt,
    });

    seedProposalCollab(feasibility.proposal);

    const reviewerCaller = await createAuthenticatedCaller(
      feasibility.reviewer.email,
    );
    const result = await reviewerCaller.decision.listReviewAssignments({
      processInstanceId: context.instance.instance.id,
      proposalProfileId: feasibility.proposal.profileId,
      sort: 'newest',
    });

    expect(result.assignments.map((a) => a.assignment.id)).toEqual(
      [community.id, feasibility.assignment.id].sort().reverse(),
    );
  });

  it('returns an empty list for an admin with no assignments on the proposal', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await createReviewPhaseContext(testData);
    const reviewer = await testData.createReviewer(context);
    const created = await testData.createReviewAssignment({
      context,
      reviewer,
      title: 'Someone else’s assignment',
    });

    seedProposalCollab(created.proposal);

    // The context's default user is an instance admin, not the assignee.
    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );
    const result = await adminCaller.decision.listReviewAssignments({
      processInstanceId: context.instance.instance.id,
      proposalProfileId: created.proposal.profileId,
    });

    expect(result.assignments).toHaveLength(0);
  });

  it('returns empty list when reviewer has no assignments', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment();
    const otherReviewer = await testData.createReviewer(created.context);

    const otherCaller = await createAuthenticatedCaller(otherReviewer.email);
    const result = await otherCaller.decision.listReviewAssignments({
      processInstanceId: created.context.instance.instance.id,
    });

    expect(result.assignments).toHaveLength(0);
  });

  it('rejects access for users without review permissions', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment();

    // Author doesn't have review access
    const authorCaller = await createAuthenticatedCaller(created.author.email);

    await expect(
      authorCaller.decision.listReviewAssignments({
        processInstanceId: created.context.instance.instance.id,
      }),
    ).rejects.toMatchObject({
      cause: { name: 'UnauthorizedError' },
    });
  });

  it('drops an assignment whose proposal was merged away', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await createReviewPhaseContext(testData);
    const merged = await testData.createReviewAssignment({
      context,
      title: 'Merged Away Proposal',
    });
    // Same context, so the same reviewer holds both assignments.
    const survivor = await testData.createReviewAssignment({
      context,
      reviewer: merged.reviewer,
      title: 'Surviving Proposal',
    });
    const instanceId = context.instance.instance.id;

    for (const created of [merged, survivor]) {
      seedProposalCollab(created.proposal);
    }

    const reviewerCaller = await createAuthenticatedCaller(
      merged.reviewer.email,
    );

    const before = await reviewerCaller.decision.listReviewAssignments({
      processInstanceId: instanceId,
    });
    expect(before.assignments).toHaveLength(2);

    // The edge directly rather than through mergeProposals: what's under test is
    // the read, and the assignment already exists at this point either way.
    await db.insert(proposalRelationships).values({
      processInstanceId: instanceId,
      sourceProposalId: merged.proposal.id,
      targetProposalId: survivor.proposal.id,
      relationshipType: ProposalRelationshipType.MERGED,
    });

    const after = await reviewerCaller.decision.listReviewAssignments({
      processInstanceId: instanceId,
    });

    expect(
      after.assignments.map((entry) => entry.assignment.proposal.id),
    ).toEqual([survivor.proposal.id]);
  });
});

describeDecisionAccessTierGating('listReviewAssignments', {
  noJwtNonPublic: accessTierGatingCell(
    'rejects no-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestReviewsDataManager(task.id, onTestFinished);
      const context = await testData.createContext();

      const caller = await callers.noJwt();

      await expectFailsAccessTierGate(
        caller.decision.listReviewAssignments({
          processInstanceId: context.instance.instance.id,
        }),
        'none',
      );
    },
  ),

  anonJwtNonPublic: accessTierGatingCell(
    'rejects anon-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestReviewsDataManager(task.id, onTestFinished);
      const context = await testData.createContext();

      const caller = await callers.anonJwt();

      await expectFailsAccessTierGate(
        caller.decision.listReviewAssignments({
          processInstanceId: context.instance.instance.id,
        }),
        'anon',
      );
    },
  ),

  userJwtNonPublic: accessTierGatingCell(
    'rejects user-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestReviewsDataManager(task.id, onTestFinished);
      const context = await testData.createContext();

      const caller = await callers.userJwt();

      await expectFailsAccessTierGate(
        caller.decision.listReviewAssignments({
          processInstanceId: context.instance.instance.id,
        }),
        'user',
      );
    },
  ),

  networkJwtNonPublic: accessTierGatingCell(
    'admits network-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestReviewsDataManager(task.id, onTestFinished);
      const context = await testData.createContext();

      const caller = await callers.networkJwt(context.defaultReviewer.email);

      const result = await caller.decision.listReviewAssignments({
        processInstanceId: context.instance.instance.id,
      });
      expect(result.assignments).toBeDefined();
    },
  ),
});
