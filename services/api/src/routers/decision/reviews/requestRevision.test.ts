import {
  ProposalReviewAssignmentStatus,
  ProposalReviewRequestState,
} from '@op/db/schema';
import { db } from '@op/db/test';
import { createRevisionRequest } from '@op/test';
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

/** Assignments default to the `'review'` phase (see `createReviewAssignment`). */
const REVIEW_PHASE = 'review';

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

/**
 * Creates an assignment and moves the instance onto the assignment's phase —
 * the state a revision cycle actually runs in. The whole cycle is rejected
 * once that phase is no longer the instance's current phase.
 */
async function createAssignmentInReviewPhase(
  testData: TestReviewsDataManager,
  opts: Parameters<TestReviewsDataManager['createReviewAssignment']>[0],
) {
  const created = await testData.createReviewAssignment(opts);
  await testData.setCurrentPhase(
    created.context.instance.instance.id,
    REVIEW_PHASE,
  );
  return created;
}

describe.concurrent('requestRevision', () => {
  it('creates a revision request and sets assignment to awaiting revision', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await createAssignmentInReviewPhase(testData, {
      title: 'Needs Budget Detail',
      status: ProposalReviewAssignmentStatus.IN_PROGRESS,
    });

    const reviewerCaller = await createAuthenticatedCaller(
      created.reviewer.email,
    );
    const result = await reviewerCaller.decision.requestRevision({
      assignmentId: created.assignment.id,
      requestComment: 'Please add a detailed budget breakdown.',
    });

    expect(result).toMatchObject({
      assignmentId: created.assignment.id,
      state: ProposalReviewRequestState.REQUESTED,
      requestComment: 'Please add a detailed budget breakdown.',
    });
    expect(result.requestedAt).toBeTruthy();

    const assignment = await db.query.proposalReviewAssignments.findFirst({
      where: { id: created.assignment.id },
    });
    expect(assignment?.status).toBe(
      ProposalReviewAssignmentStatus.AWAITING_AUTHOR_REVISION,
    );
  });

  it('rejects a revision request once the instance advances past the assignment phase', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await createAssignmentInReviewPhase(testData, {
      title: 'Phase Moved On',
      status: ProposalReviewAssignmentStatus.IN_PROGRESS,
    });

    // A past-phase request would open a revision cycle nobody may complete.
    await testData.setCurrentPhase(
      created.context.instance.instance.id,
      'voting',
    );

    const reviewerCaller = await createAuthenticatedCaller(
      created.reviewer.email,
    );

    await expect(
      reviewerCaller.decision.requestRevision({
        assignmentId: created.assignment.id,
        requestComment: 'Too late for revisions',
      }),
    ).rejects.toThrow('the review phase has ended');

    const assignment = await db.query.proposalReviewAssignments.findFirst({
      where: { id: created.assignment.id },
    });
    expect(assignment?.status).toBe(ProposalReviewAssignmentStatus.IN_PROGRESS);
  });

  it('rejects when a revision is already pending', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await createAssignmentInReviewPhase(testData, {
      title: 'Already Awaiting',
      status: ProposalReviewAssignmentStatus.AWAITING_AUTHOR_REVISION,
    });

    await createRevisionRequest({
      assignmentId: created.assignment.id,
      requestComment: 'First request',
    });

    const reviewerCaller = await createAuthenticatedCaller(
      created.reviewer.email,
    );

    await expect(
      reviewerCaller.decision.requestRevision({
        assignmentId: created.assignment.id,
        requestComment: 'Second request',
      }),
    ).rejects.toMatchObject({
      cause: { name: 'ValidationError' },
    });
  });

  it('rejects when the assignment is already completed', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await createAssignmentInReviewPhase(testData, {
      title: 'Already Done',
      status: ProposalReviewAssignmentStatus.COMPLETED,
    });

    const reviewerCaller = await createAuthenticatedCaller(
      created.reviewer.email,
    );

    await expect(
      reviewerCaller.decision.requestRevision({
        assignmentId: created.assignment.id,
        requestComment: 'Too late',
      }),
    ).rejects.toMatchObject({
      cause: { name: 'ValidationError' },
    });
  });

  it('allows a new revision request after cancelling a previous one', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await createAssignmentInReviewPhase(testData, {
      title: 'Cancel Then Re-request',
      status: ProposalReviewAssignmentStatus.IN_PROGRESS,
    });

    const reviewerCaller = await createAuthenticatedCaller(
      created.reviewer.email,
    );

    const firstRequest = await reviewerCaller.decision.requestRevision({
      assignmentId: created.assignment.id,
      requestComment: 'Please add budget details.',
    });
    expect(firstRequest.state).toBe(ProposalReviewRequestState.REQUESTED);

    await reviewerCaller.decision.cancelRevisionRequest({
      assignmentId: created.assignment.id,
      revisionRequestId: firstRequest.id,
    });

    const secondRequest = await reviewerCaller.decision.requestRevision({
      assignmentId: created.assignment.id,
      requestComment: 'Actually, please also add a timeline.',
    });

    expect(secondRequest).toMatchObject({
      assignmentId: created.assignment.id,
      state: ProposalReviewRequestState.REQUESTED,
      requestComment: 'Actually, please also add a timeline.',
    });
    expect(secondRequest.id).not.toBe(firstRequest.id);

    const assignment = await db.query.proposalReviewAssignments.findFirst({
      where: { id: created.assignment.id },
    });
    expect(assignment?.status).toBe(
      ProposalReviewAssignmentStatus.AWAITING_AUTHOR_REVISION,
    );
  });

  it('rejects access for a different reviewer', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await createAssignmentInReviewPhase(testData, {
      title: 'Not My Assignment',
    });
    const otherReviewer = await testData.createReviewer(created.context);

    const otherCaller = await createAuthenticatedCaller(otherReviewer.email);

    await expect(
      otherCaller.decision.requestRevision({
        assignmentId: created.assignment.id,
        requestComment: 'Should not work',
      }),
    ).rejects.toMatchObject({
      cause: { name: 'UnauthorizedError' },
    });
  });
});

describeDecisionAccessTierGating('requestRevision', {
  noJwtNonPublic: accessTierGatingCell(
    'rejects no-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestReviewsDataManager(task.id, onTestFinished);
      await testData.createContext();

      const caller = await callers.noJwt();

      await expectFailsAccessTierGate(
        caller.decision.requestRevision({
          assignmentId: crypto.randomUUID(),
          requestComment: 'Should not reach',
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
        caller.decision.requestRevision({
          assignmentId: crypto.randomUUID(),
          requestComment: 'Should not reach',
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
        caller.decision.requestRevision({
          assignmentId: crypto.randomUUID(),
          requestComment: 'Should not reach',
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
        caller.decision.requestRevision({
          assignmentId: crypto.randomUUID(),
          requestComment: 'Past the gate; assignment missing',
        }),
      ).rejects.not.toMatchObject({
        cause: { name: 'UnauthorizedError' },
      });
    },
  ),
});
