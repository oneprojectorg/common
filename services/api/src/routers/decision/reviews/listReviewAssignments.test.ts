import { mockCollab } from '@op/collab/testing';
import type { RubricTemplateSchema } from '@op/common';
import {
  ProposalReviewAssignmentStatus,
  ProposalReviewRequestState,
  ProposalReviewState,
} from '@op/db/schema';
import {
  createProposalReview,
  createReviewAssignment as createReviewAssignmentRow,
  createRevisionRequest,
} from '@op/test';
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

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
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

describe.concurrent('listReviewAssignments', () => {
  it('returns the assignment using the live proposal when no history snapshot exists', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
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

  it('returns all assignments for the reviewer in the instance', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const first = await testData.createReviewAssignment({
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
