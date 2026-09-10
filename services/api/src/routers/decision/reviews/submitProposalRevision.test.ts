import type { RubricTemplateSchema } from '@op/common';
import {
  ProposalReviewAssignmentStatus,
  ProposalReviewRequestState,
} from '@op/db/schema';
import { db } from '@op/db/test';
import {
  createReviewAssignment,
  createRevisionRequest,
  getLatestProposalHistoryId,
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

// Minimal rubric so a reviewer can submit a review and drive their assignment
// to COMPLETED while their revision request is still open.
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
        { const: 2, title: 'Medium' },
        { const: 3, title: 'High' },
      ],
    },
  },
  required: ['impact'],
};

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

describe.concurrent('submitProposalRevision', () => {
  it('answers every open request on the proposal with one note', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: 'Two Reviewers, One Note',
      status: ProposalReviewAssignmentStatus.AWAITING_AUTHOR_REVISION,
    });

    const secondReviewer = await testData.createReviewer(created.context);
    const secondAssignment = await createReviewAssignment({
      processInstanceId: created.context.instance.instance.id,
      proposalId: created.proposal.id,
      reviewerProfileId: secondReviewer.profileId,
      status: ProposalReviewAssignmentStatus.AWAITING_AUTHOR_REVISION,
    });

    const firstRequest = await createRevisionRequest({
      assignmentId: created.assignment.id,
      requestComment: 'Please add budget details.',
    });
    const secondRequest = await createRevisionRequest({
      assignmentId: secondAssignment.id,
      requestComment: 'Please name the partners.',
    });

    const authorCaller = await createAuthenticatedCaller(created.author.email);
    const result = await authorCaller.decision.submitProposalRevision({
      proposalId: created.proposal.id,
      note: 'Added the budget and the partner list.',
    });

    expect(result.items).toHaveLength(2);
    expect(result.items.map((item) => item.id).sort()).toEqual(
      [firstRequest.id, secondRequest.id].sort(),
    );

    const requests = await db.query.proposalReviewRequests.findMany({
      where: { id: { in: [firstRequest.id, secondRequest.id] } },
    });

    expect(requests).toHaveLength(2);
    for (const request of requests) {
      expect(request.state).toBe(ProposalReviewRequestState.RESUBMITTED);
      expect(request.responseComment).toBe(
        'Added the budget and the partner list.',
      );
      expect(request.respondedProposalHistoryId).toBeTruthy();
    }

    // One resubmission is one author note: the rows are grouped by the shared
    // timestamp and history pointer.
    const [first, second] = requests;
    expect(first?.respondedAt).toBe(second?.respondedAt);
    expect(first?.respondedProposalHistoryId).toBe(
      second?.respondedProposalHistoryId,
    );

    const assignments = await db.query.proposalReviewAssignments.findMany({
      where: { id: { in: [created.assignment.id, secondAssignment.id] } },
    });

    for (const assignment of assignments) {
      expect(assignment.assignedProposalHistoryId).toBe(
        first?.respondedProposalHistoryId,
      );
    }
  });

  it('resumes only the assignments the revision paused', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: 'Paused and Completed',
      status: ProposalReviewAssignmentStatus.IN_PROGRESS,
    });
    await testData.setRubricTemplate(created.context, rubricTemplate);

    const originalHistoryId = await getLatestProposalHistoryId({
      proposalId: created.proposal.id,
    });

    const secondReviewer = await testData.createReviewer(created.context);
    const secondAssignment = await createReviewAssignment({
      processInstanceId: created.context.instance.instance.id,
      proposalId: created.proposal.id,
      reviewerProfileId: secondReviewer.profileId,
      assignedProposalHistoryId: originalHistoryId,
      status: ProposalReviewAssignmentStatus.IN_PROGRESS,
    });

    const firstReviewerCaller = await createAuthenticatedCaller(
      created.reviewer.email,
    );
    await firstReviewerCaller.decision.requestRevision({
      assignmentId: created.assignment.id,
      requestComment: 'Please add budget details.',
    });

    const secondReviewerCaller = await createAuthenticatedCaller(
      secondReviewer.email,
    );
    await secondReviewerCaller.decision.requestRevision({
      assignmentId: secondAssignment.id,
      requestComment: 'Please name the partners.',
    });
    await secondReviewerCaller.decision.submitReview({
      assignmentId: secondAssignment.id,
      reviewData: { answers: { impact: 3 }, rationales: {} },
    });

    const authorCaller = await createAuthenticatedCaller(created.author.email);
    const result = await authorCaller.decision.submitProposalRevision({
      proposalId: created.proposal.id,
      note: 'Revised throughout.',
    });

    expect(result.items).toHaveLength(2);

    const answeredRequest = await db.query.proposalReviewRequests.findFirst({
      where: { assignmentId: created.assignment.id },
    });

    const pausedAssignment = await db.query.proposalReviewAssignments.findFirst(
      {
        where: { id: created.assignment.id },
      },
    );
    expect(pausedAssignment?.status).toBe(
      ProposalReviewAssignmentStatus.READY_FOR_RE_REVIEW,
    );
    expect(pausedAssignment?.assignedProposalHistoryId).toBe(
      answeredRequest?.respondedProposalHistoryId,
    );

    // Nothing the author does touches a submitted review: the status and the
    // pin both stay, so the out-of-date flag is what surfaces the new version.
    const completedAssignment =
      await db.query.proposalReviewAssignments.findFirst({
        where: { id: secondAssignment.id },
      });
    expect(completedAssignment?.status).toBe(
      ProposalReviewAssignmentStatus.COMPLETED,
    );
    expect(completedAssignment?.assignedProposalHistoryId).toBe(
      originalHistoryId,
    );
    expect(pausedAssignment?.assignedProposalHistoryId).not.toBe(
      originalHistoryId,
    );
  });

  it('leaves a request from an earlier phase untouched', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: 'Carried Over Request',
      status: ProposalReviewAssignmentStatus.AWAITING_AUTHOR_REVISION,
    });

    const pastPhaseReviewer = await testData.createReviewer(created.context);
    const pastPhaseAssignment = await createReviewAssignment({
      processInstanceId: created.context.instance.instance.id,
      proposalId: created.proposal.id,
      reviewerProfileId: pastPhaseReviewer.profileId,
      phaseId: 'submission',
      status: ProposalReviewAssignmentStatus.AWAITING_AUTHOR_REVISION,
    });

    const currentRequest = await createRevisionRequest({
      assignmentId: created.assignment.id,
      requestComment: 'Please add budget details.',
    });
    const pastPhaseRequest = await createRevisionRequest({
      assignmentId: pastPhaseAssignment.id,
      requestComment: 'Left over from the submission phase.',
    });

    const authorCaller = await createAuthenticatedCaller(created.author.email);
    const result = await authorCaller.decision.submitProposalRevision({
      proposalId: created.proposal.id,
      note: 'Added the budget.',
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe(currentRequest.id);

    const untouched = await db.query.proposalReviewRequests.findFirst({
      where: { id: pastPhaseRequest.id },
    });
    expect(untouched?.state).toBe(ProposalReviewRequestState.REQUESTED);
    expect(untouched?.respondedProposalHistoryId).toBeNull();

    const untouchedAssignment =
      await db.query.proposalReviewAssignments.findFirst({
        where: { id: pastPhaseAssignment.id },
      });
    expect(untouchedAssignment?.status).toBe(
      ProposalReviewAssignmentStatus.AWAITING_AUTHOR_REVISION,
    );
  });

  it('rejects an empty note', async ({ task, onTestFinished }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: 'No Note',
      status: ProposalReviewAssignmentStatus.AWAITING_AUTHOR_REVISION,
    });

    await createRevisionRequest({
      assignmentId: created.assignment.id,
      requestComment: 'Please revise.',
    });

    const authorCaller = await createAuthenticatedCaller(created.author.email);

    await expect(
      authorCaller.decision.submitProposalRevision({
        proposalId: created.proposal.id,
        note: '   ',
      }),
    ).rejects.toThrow();

    const request = await db.query.proposalReviewRequests.findFirst({
      where: { assignmentId: created.assignment.id },
    });
    expect(request?.state).toBe(ProposalReviewRequestState.REQUESTED);
  });

  it('rejects a second resubmission when nothing is open', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: 'Nothing Left To Answer',
      status: ProposalReviewAssignmentStatus.AWAITING_AUTHOR_REVISION,
    });

    await createRevisionRequest({
      assignmentId: created.assignment.id,
      requestComment: 'Please revise.',
    });

    const authorCaller = await createAuthenticatedCaller(created.author.email);
    await authorCaller.decision.submitProposalRevision({
      proposalId: created.proposal.id,
      note: 'Revised.',
    });

    await expect(
      authorCaller.decision.submitProposalRevision({
        proposalId: created.proposal.id,
        note: 'Revised again.',
      }),
    ).rejects.toMatchObject({
      cause: { name: 'ValidationError' },
    });
  });

  it('rejects a caller who is not the proposal author', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: 'Not My Proposal',
      status: ProposalReviewAssignmentStatus.AWAITING_AUTHOR_REVISION,
    });

    await createRevisionRequest({
      assignmentId: created.assignment.id,
      requestComment: 'Please revise.',
    });

    const reviewerCaller = await createAuthenticatedCaller(
      created.reviewer.email,
    );

    await expect(
      reviewerCaller.decision.submitProposalRevision({
        proposalId: created.proposal.id,
        note: 'Should not work.',
      }),
    ).rejects.toMatchObject({
      cause: { name: 'UnauthorizedError' },
    });
  });

  it('rejects when the proposal does not exist', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: 'Missing Proposal',
    });

    const authorCaller = await createAuthenticatedCaller(created.author.email);

    await expect(
      authorCaller.decision.submitProposalRevision({
        proposalId: '00000000-0000-0000-0000-000000000000',
        note: 'Nothing to answer.',
      }),
    ).rejects.toMatchObject({
      cause: { name: 'NotFoundError' },
    });
  });
});

describeDecisionAccessTierGating('submitProposalRevision', {
  noJwtNonPublic: accessTierGatingCell(
    'rejects no-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestReviewsDataManager(task.id, onTestFinished);
      await testData.createContext();

      const caller = await callers.noJwt();

      await expectFailsAccessTierGate(
        caller.decision.submitProposalRevision({
          proposalId: crypto.randomUUID(),
          note: 'Revised.',
        }),
        'none',
      );
    },
  ),

  anonJwtNonPublic: accessTierGatingCell(
    'rejects anon-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestReviewsDataManager(task.id, onTestFinished);
      await testData.createContext();

      const caller = await callers.anonJwt();

      await expectFailsAccessTierGate(
        caller.decision.submitProposalRevision({
          proposalId: crypto.randomUUID(),
          note: 'Revised.',
        }),
        'anon',
      );
    },
  ),

  userJwtNonPublic: accessTierGatingCell(
    'rejects user-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestReviewsDataManager(task.id, onTestFinished);
      await testData.createContext();

      const caller = await callers.userJwt();

      await expectFailsAccessTierGate(
        caller.decision.submitProposalRevision({
          proposalId: crypto.randomUUID(),
          note: 'Revised.',
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

      await expect(
        caller.decision.submitProposalRevision({
          proposalId: crypto.randomUUID(),
          note: 'Revised.',
        }),
      ).rejects.not.toMatchObject({
        cause: { name: 'UnauthorizedError' },
      });
    },
  ),
});
