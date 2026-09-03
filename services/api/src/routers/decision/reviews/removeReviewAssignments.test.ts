import type { RubricTemplateSchema } from '@op/common';
import {
  ProposalReviewAssignmentStatus,
  ProposalReviewState,
} from '@op/db/schema';
import { db } from '@op/db/test';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { TestReviewsDataManager } from '../../../test/helpers/TestReviewsDataManager';
import {
  accessTierGatingCell,
  describeDecisionAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../../test/helpers/gating/decision';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../../test/supabase-utils';
import { createCallerFactory } from '../../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

/** Minimal rubric, so the reviewer can start a review. */
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

/**
 * One assignment in the current phase. `defaultReviewer` is both the admin and
 * the reviewer, so one caller can start the review and then try to unassign.
 */
async function createRemovableAssignment(
  taskId: string,
  onTestFinished: ConstructorParameters<typeof TestReviewsDataManager>[1],
  opts: { status?: ProposalReviewAssignmentStatus; phaseId?: string } = {},
) {
  const testData = new TestReviewsDataManager(taskId, onTestFinished);
  const created = await testData.createReviewAssignment({
    title: `Unassignable proposal ${taskId}`,
    status: opts.status ?? ProposalReviewAssignmentStatus.PENDING,
    phaseId: opts.phaseId,
  });
  await testData.setRubricTemplate(created.context, rubricTemplate);

  return {
    testData,
    created,
    context: created.context,
    processInstanceId: created.context.instance.instance.id,
    assignmentId: created.assignment.id,
    phaseId: opts.phaseId ?? 'review',
  };
}

describe.concurrent('decision.removeReviewAssignments', () => {
  it('removes a pending assignment for an instance admin', async ({
    task,
    onTestFinished,
  }) => {
    const { context, processInstanceId, assignmentId } =
      await createRemovableAssignment(task.id, onTestFinished);

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.removeReviewAssignments({
      processInstanceId,
      phaseId: 'review',
      assignmentIds: [assignmentId],
    });
    expect(result).toEqual({ removedCount: 1, skippedIds: [] });

    const assignment = await db.query.proposalReviewAssignments.findFirst({
      where: { id: assignmentId },
    });
    expect(assignment).toBeUndefined();

    const summaries = await adminCaller.decision.listPhaseReviewerSummaries({
      processInstanceId,
      phaseId: 'review',
    });
    expect(summaries.totalAssignments).toBe(0);
  });

  it('skips an assignment the reviewer has started, keeping their draft', async ({
    task,
    onTestFinished,
  }) => {
    const { context, processInstanceId, assignmentId } =
      await createRemovableAssignment(task.id, onTestFinished);

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    await adminCaller.decision.saveReviewDraft({
      assignmentId,
      reviewData: {
        answers: { impact: 2 },
        rationales: { impact: 'Still reading' },
      },
    });

    const result = await adminCaller.decision.removeReviewAssignments({
      processInstanceId,
      phaseId: 'review',
      assignmentIds: [assignmentId],
    });
    expect(result).toEqual({ removedCount: 0, skippedIds: [assignmentId] });

    const assignment = await db.query.proposalReviewAssignments.findFirst({
      where: { id: assignmentId },
    });
    expect(assignment?.status).toBe(ProposalReviewAssignmentStatus.IN_PROGRESS);

    // The FK cascades off assignmentId; the draft proves nothing was deleted.
    const review = await db.query.proposalReviews.findFirst({
      where: { assignmentId },
    });
    expect(review?.state).toBe(ProposalReviewState.DRAFT);
  });

  it('skips a completed assignment, keeping its submitted review', async ({
    task,
    onTestFinished,
  }) => {
    const { context, processInstanceId, assignmentId } =
      await createRemovableAssignment(task.id, onTestFinished);

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    await adminCaller.decision.submitReview({
      assignmentId,
      reviewData: {
        answers: { impact: 3 },
        rationales: { impact: 'Final' },
      },
    });

    const result = await adminCaller.decision.removeReviewAssignments({
      processInstanceId,
      phaseId: 'review',
      assignmentIds: [assignmentId],
    });
    expect(result).toEqual({ removedCount: 0, skippedIds: [assignmentId] });

    const assignment = await db.query.proposalReviewAssignments.findFirst({
      where: { id: assignmentId },
    });
    expect(assignment?.status).toBe(ProposalReviewAssignmentStatus.COMPLETED);

    const review = await db.query.proposalReviews.findFirst({
      where: { assignmentId },
    });
    expect(review?.state).toBe(ProposalReviewState.SUBMITTED);
  });

  it('removes the pending rows of a mixed batch and skips the started one', async ({
    task,
    onTestFinished,
  }) => {
    const { testData, context, processInstanceId, assignmentId } =
      await createRemovableAssignment(task.id, onTestFinished);

    const second = await testData.createReviewAssignment({
      context,
      reviewer: context.defaultReviewer,
      title: `Second unassignable proposal ${task.id}`,
      status: ProposalReviewAssignmentStatus.PENDING,
    });

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    await adminCaller.decision.saveReviewDraft({
      assignmentId,
      reviewData: {
        answers: { impact: 1 },
        rationales: { impact: 'Started this one' },
      },
    });

    const result = await adminCaller.decision.removeReviewAssignments({
      processInstanceId,
      phaseId: 'review',
      assignmentIds: [assignmentId, second.assignment.id],
    });
    expect(result).toEqual({ removedCount: 1, skippedIds: [assignmentId] });

    const started = await db.query.proposalReviewAssignments.findFirst({
      where: { id: assignmentId },
    });
    expect(started?.status).toBe(ProposalReviewAssignmentStatus.IN_PROGRESS);
    const review = await db.query.proposalReviews.findFirst({
      where: { assignmentId },
    });
    expect(review?.state).toBe(ProposalReviewState.DRAFT);

    const removed = await db.query.proposalReviewAssignments.findFirst({
      where: { id: second.assignment.id },
    });
    expect(removed).toBeUndefined();
  });

  it('skips an id that no longer exists, so a repeat request settles', async ({
    task,
    onTestFinished,
  }) => {
    const { context, processInstanceId, assignmentId } =
      await createRemovableAssignment(task.id, onTestFinished);

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const first = await adminCaller.decision.removeReviewAssignments({
      processInstanceId,
      phaseId: 'review',
      assignmentIds: [assignmentId],
    });
    expect(first.removedCount).toBe(1);

    const second = await adminCaller.decision.removeReviewAssignments({
      processInstanceId,
      phaseId: 'review',
      assignmentIds: [assignmentId],
    });
    expect(second).toEqual({ removedCount: 0, skippedIds: [assignmentId] });

    const unknownId = crypto.randomUUID();
    const third = await adminCaller.decision.removeReviewAssignments({
      processInstanceId,
      phaseId: 'review',
      assignmentIds: [unknownId],
    });
    expect(third).toEqual({ removedCount: 0, skippedIds: [unknownId] });
  });

  it('refuses a phase the instance has moved past', async ({
    task,
    onTestFinished,
  }) => {
    const { testData, processInstanceId, context, assignmentId } =
      await createRemovableAssignment(task.id, onTestFinished);

    await testData.setCurrentPhase(processInstanceId, 'voting');

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    await expect(
      adminCaller.decision.removeReviewAssignments({
        processInstanceId,
        phaseId: 'review',
        assignmentIds: [assignmentId],
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });

    const assignment = await db.query.proposalReviewAssignments.findFirst({
      where: { id: assignmentId },
    });
    expect(assignment).toBeDefined();
  });

  it('refuses an assignment pinned to another phase of the same instance', async ({
    task,
    onTestFinished,
  }) => {
    const { testData, processInstanceId, context, assignmentId } =
      await createRemovableAssignment(task.id, onTestFinished, {
        phaseId: 'submission',
      });

    await testData.setCurrentPhase(processInstanceId, 'review');

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    await expect(
      adminCaller.decision.removeReviewAssignments({
        processInstanceId,
        phaseId: 'review',
        assignmentIds: [assignmentId],
      }),
    ).rejects.toMatchObject({ cause: { name: 'NotFoundError' } });

    const assignment = await db.query.proposalReviewAssignments.findFirst({
      where: { id: assignmentId },
    });
    expect(assignment).toBeDefined();
  });

  it('refuses the whole batch when one id belongs to another instance', async ({
    task,
    onTestFinished,
  }) => {
    const { context, processInstanceId, assignmentId } =
      await createRemovableAssignment(task.id, onTestFinished);

    const otherTestData = new TestReviewsDataManager(
      `${task.id}-other`,
      onTestFinished,
    );
    const other = await otherTestData.createReviewAssignment({
      title: `Other-instance proposal ${task.id}`,
      status: ProposalReviewAssignmentStatus.PENDING,
    });

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    await expect(
      adminCaller.decision.removeReviewAssignments({
        processInstanceId,
        phaseId: 'review',
        assignmentIds: [assignmentId, other.assignment.id],
      }),
    ).rejects.toMatchObject({ cause: { name: 'NotFoundError' } });

    const own = await db.query.proposalReviewAssignments.findFirst({
      where: { id: assignmentId },
    });
    expect(own).toBeDefined();
    const foreign = await db.query.proposalReviewAssignments.findFirst({
      where: { id: other.assignment.id },
    });
    expect(foreign).toBeDefined();
  });

  it('rejects a reviewer who is not an instance admin', async ({
    task,
    onTestFinished,
  }) => {
    const { testData, context, processInstanceId, assignmentId } =
      await createRemovableAssignment(task.id, onTestFinished);

    const reviewer = await testData.createInstanceReviewerWithRole(context);
    const reviewerCaller = await createAuthenticatedCaller(reviewer.email);

    await expect(
      reviewerCaller.decision.removeReviewAssignments({
        processInstanceId,
        phaseId: 'review',
        assignmentIds: [assignmentId],
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });

    const assignment = await db.query.proposalReviewAssignments.findFirst({
      where: { id: assignmentId },
    });
    expect(assignment).toBeDefined();
  });

  it('rejects a plain instance member', async ({ task, onTestFinished }) => {
    const { testData, context, processInstanceId, assignmentId } =
      await createRemovableAssignment(task.id, onTestFinished);

    const member = await testData.createInstanceMember(context);
    const memberCaller = await createAuthenticatedCaller(member.email);

    await expect(
      memberCaller.decision.removeReviewAssignments({
        processInstanceId,
        phaseId: 'review',
        assignmentIds: [assignmentId],
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });

    const assignment = await db.query.proposalReviewAssignments.findFirst({
      where: { id: assignmentId },
    });
    expect(assignment).toBeDefined();
  });
});

describeDecisionAccessTierGating('decision.removeReviewAssignments', {
  noJwtNonPublic: accessTierGatingCell(
    'rejects no-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestReviewsDataManager(task.id, onTestFinished);
      const context = await testData.createContext();

      const caller = await callers.noJwt();

      await expectFailsAccessTierGate(
        caller.decision.removeReviewAssignments({
          processInstanceId: context.instance.instance.id,
          phaseId: 'review',
          assignmentIds: [crypto.randomUUID()],
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
        caller.decision.removeReviewAssignments({
          processInstanceId: context.instance.instance.id,
          phaseId: 'review',
          assignmentIds: [crypto.randomUUID()],
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
        caller.decision.removeReviewAssignments({
          processInstanceId: context.instance.instance.id,
          phaseId: 'review',
          assignmentIds: [crypto.randomUUID()],
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
      await testData.setCurrentPhase(context.instance.instance.id, 'review');

      const caller = await callers.networkJwt(context.defaultReviewer.email);

      // An unknown id is a skip, so admission is the resolve.
      await expectPassesAccessTierGate(
        caller.decision.removeReviewAssignments({
          processInstanceId: context.instance.instance.id,
          phaseId: 'review',
          assignmentIds: [crypto.randomUUID()],
        }),
      );
    },
  ),
});
