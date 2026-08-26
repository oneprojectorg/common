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
} from '../../../test/helpers/gating/decision';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../../test/supabase-utils';
import { createCallerFactory } from '../../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

/** Minimal rubric, so the reviewer can save a draft and start the review. */
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

/** Narrows `cause.name` without a type assertion (the repo forbids `as`). */
function causeNameOf(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('cause' in error)) {
    return undefined;
  }
  const { cause } = error;
  if (typeof cause !== 'object' || cause === null || !('name' in cause)) {
    return undefined;
  }
  const { name } = cause;
  return typeof name === 'string' ? name : undefined;
}

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

/**
 * One assignment in the instance's current phase. `defaultReviewer` is both
 * the instance admin and the assignment's reviewer, so a single caller can
 * start the review and then try to unassign it.
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

describe.concurrent('decision.removeReviewAssignment', () => {
  it('removes a pending assignment for an instance admin', async ({
    task,
    onTestFinished,
  }) => {
    const { context, processInstanceId, assignmentId } =
      await createRemovableAssignment(task.id, onTestFinished);

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.removeReviewAssignment({
      processInstanceId,
      phaseId: 'review',
      assignmentId,
    });
    expect(result.removedCount).toBe(1);

    const assignment = await db.query.proposalReviewAssignments.findFirst({
      where: { id: assignmentId },
    });
    expect(assignment).toBeUndefined();

    const listing = await adminCaller.decision.listPhaseReviewAssignments({
      processInstanceId,
      phaseId: 'review',
    });
    expect(listing.totalAssignments).toBe(0);
  });

  it('refuses an assignment the reviewer has started, keeping their draft', async ({
    task,
    onTestFinished,
  }) => {
    const { context, processInstanceId, assignmentId } =
      await createRemovableAssignment(task.id, onTestFinished);

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    // The real transition into IN_PROGRESS, rather than a status write, so the
    // cascade this guard protects has something to destroy.
    await adminCaller.decision.saveReviewDraft({
      assignmentId,
      reviewData: {
        answers: { impact: 2 },
        rationales: { impact: 'Still reading' },
      },
    });

    await expect(
      adminCaller.decision.removeReviewAssignment({
        processInstanceId,
        phaseId: 'review',
        assignmentId,
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });

    const assignment = await db.query.proposalReviewAssignments.findFirst({
      where: { id: assignmentId },
    });
    expect(assignment?.status).toBe(ProposalReviewAssignmentStatus.IN_PROGRESS);

    // The FK cascades off assignmentId — the draft proves nothing was deleted.
    const review = await db.query.proposalReviews.findFirst({
      where: { assignmentId },
    });
    expect(review?.state).toBe(ProposalReviewState.DRAFT);
  });

  it('refuses a completed assignment', async ({ task, onTestFinished }) => {
    const { context, processInstanceId, assignmentId } =
      await createRemovableAssignment(task.id, onTestFinished, {
        status: ProposalReviewAssignmentStatus.COMPLETED,
      });

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    await expect(
      adminCaller.decision.removeReviewAssignment({
        processInstanceId,
        phaseId: 'review',
        assignmentId,
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });

    const assignment = await db.query.proposalReviewAssignments.findFirst({
      where: { id: assignmentId },
    });
    expect(assignment?.status).toBe(ProposalReviewAssignmentStatus.COMPLETED);
  });

  it('refuses a phase the instance has moved past', async ({
    task,
    onTestFinished,
  }) => {
    const { testData, processInstanceId, context, assignmentId } =
      await createRemovableAssignment(task.id, onTestFinished);

    // Assignments survive a phase advance; unassigning them must not.
    await testData.setCurrentPhase(processInstanceId, 'voting');

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    await expect(
      adminCaller.decision.removeReviewAssignment({
        processInstanceId,
        phaseId: 'review',
        assignmentId,
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
      adminCaller.decision.removeReviewAssignment({
        processInstanceId,
        phaseId: 'review',
        assignmentId,
      }),
    ).rejects.toMatchObject({ cause: { name: 'NotFoundError' } });

    const assignment = await db.query.proposalReviewAssignments.findFirst({
      where: { id: assignmentId },
    });
    expect(assignment).toBeDefined();
  });

  it('refuses an assignment that belongs to another instance', async ({
    task,
    onTestFinished,
  }) => {
    const { context, processInstanceId } = await createRemovableAssignment(
      task.id,
      onTestFinished,
    );

    // A second, unrelated instance: its assignment id must not be removable
    // through the instance the caller administers.
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
      adminCaller.decision.removeReviewAssignment({
        processInstanceId,
        phaseId: 'review',
        assignmentId: other.assignment.id,
      }),
    ).rejects.toMatchObject({ cause: { name: 'NotFoundError' } });

    const assignment = await db.query.proposalReviewAssignments.findFirst({
      where: { id: other.assignment.id },
    });
    expect(assignment).toBeDefined();
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
      reviewerCaller.decision.removeReviewAssignment({
        processInstanceId,
        phaseId: 'review',
        assignmentId,
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
      memberCaller.decision.removeReviewAssignment({
        processInstanceId,
        phaseId: 'review',
        assignmentId,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });

    const assignment = await db.query.proposalReviewAssignments.findFirst({
      where: { id: assignmentId },
    });
    expect(assignment).toBeDefined();
  });
});

describeDecisionAccessTierGating('decision.removeReviewAssignment', {
  noJwtNonPublic: accessTierGatingCell(
    'rejects no-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestReviewsDataManager(task.id, onTestFinished);
      const context = await testData.createContext();

      const caller = await callers.noJwt();

      await expectFailsAccessTierGate(
        caller.decision.removeReviewAssignment({
          processInstanceId: context.instance.instance.id,
          phaseId: 'review',
          assignmentId: crypto.randomUUID(),
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
        caller.decision.removeReviewAssignment({
          processInstanceId: context.instance.instance.id,
          phaseId: 'review',
          assignmentId: crypto.randomUUID(),
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
        caller.decision.removeReviewAssignment({
          processInstanceId: context.instance.instance.id,
          phaseId: 'review',
          assignmentId: crypto.randomUUID(),
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

      // Past the admin gate, dying on the unknown assignment id — proves the
      // call reached the service.
      let caught: unknown;
      try {
        await caller.decision.removeReviewAssignment({
          processInstanceId: context.instance.instance.id,
          phaseId: 'review',
          assignmentId: crypto.randomUUID(),
        });
      } catch (err) {
        caught = err;
      }
      expect(causeNameOf(caught)).toBe('NotFoundError');
    },
  ),
});
