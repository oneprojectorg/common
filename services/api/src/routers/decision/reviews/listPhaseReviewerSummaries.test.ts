import {
  ProposalReviewAssignmentStatus,
  ProposalReviewState,
} from '@op/db/schema';
import { createProposalReview } from '@op/test';
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

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

describe.concurrent('decision.listPhaseReviewerSummaries', () => {
  it('aggregates assigned, submitted and draft counts and the last submission', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const submitted = await testData.createReviewAssignment({
      title: `Submitted proposal ${task.id}`,
      status: ProposalReviewAssignmentStatus.IN_PROGRESS,
    });
    const context = submitted.context;
    const drafted = await testData.createReviewAssignment({
      context,
      title: `Drafted proposal ${task.id}`,
      status: ProposalReviewAssignmentStatus.IN_PROGRESS,
    });
    await testData.setCurrentPhase(context.instance.instance.id, 'review');

    const submittedAt = new Date().toISOString();
    await createProposalReview({
      assignmentId: submitted.assignment.id,
      state: ProposalReviewState.SUBMITTED,
      reviewData: { answers: {}, rationales: {} },
      submittedAt,
    });
    await createProposalReview({
      assignmentId: drafted.assignment.id,
      state: ProposalReviewState.DRAFT,
      reviewData: { answers: {}, rationales: {} },
    });

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.listPhaseReviewerSummaries({
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
    });

    expect(result.totalAssignments).toBe(2);
    const summary = result.items.find(
      (candidate) =>
        candidate.reviewer.id === context.defaultReviewer.profileId,
    );
    expect(summary?.assignedCount).toBe(2);
    expect(summary?.submittedCount).toBe(1);
    expect(summary?.draftCount).toBe(1);
    expect(summary?.lastSubmittedAt).not.toBeNull();
  });

  it('orders by assigned count then id, and lists idle reviewers last with zero', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const first = await testData.createReviewAssignment({
      title: `Ordered proposal A1 ${task.id}`,
      status: ProposalReviewAssignmentStatus.PENDING,
    });
    const context = first.context;
    await testData.createReviewAssignment({
      context,
      title: `Ordered proposal A2 ${task.id}`,
      status: ProposalReviewAssignmentStatus.PENDING,
    });

    const ties = [
      await testData.createInstanceMember(context),
      await testData.createInstanceMember(context),
    ];
    for (const [reviewer, title] of [
      [ties[0], `Ordered proposal B ${task.id}`],
      [ties[1], `Ordered proposal C ${task.id}`],
    ] as const) {
      await testData.createReviewAssignment({
        context,
        reviewer,
        title,
        status: ProposalReviewAssignmentStatus.PENDING,
      });
    }
    const idle = await testData.createInstanceReviewerWithRole(context);
    await testData.setCurrentPhase(context.instance.instance.id, 'review');

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );
    const result = await adminCaller.decision.listPhaseReviewerSummaries({
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
    });

    const expected = [
      context.defaultReviewer.profileId,
      ...ties.map((tie) => tie.profileId).sort(),
      idle.profileId,
    ];
    const ordered = result.items.filter((summary) =>
      expected.includes(summary.reviewer.id),
    );
    expect(ordered.map((summary) => summary.reviewer.id)).toEqual(expected);
    expect(ordered.map((summary) => summary.assignedCount)).toEqual([
      2, 1, 1, 0,
    ]);
  });

  it('pages in order without repeats or gaps, with phase-wide totals on every page', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const seeded = await seedPagedReviewers(testData, task.id);
    const { context, expectedProfileIds } = seeded;

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const firstPage = await adminCaller.decision.listPhaseReviewerSummaries({
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
      limit: 2,
    });

    expect(firstPage.items.map((row) => row.reviewer.id)).toEqual(
      expectedProfileIds.slice(0, 2),
    );
    expect(firstPage.items.map((row) => row.assignedCount)).toEqual([2, 1]);
    expect(firstPage.next).not.toBeNull();

    const secondPage = await adminCaller.decision.listPhaseReviewerSummaries({
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
      limit: 2,
      cursor: firstPage.next,
    });

    expect(secondPage.items.map((row) => row.reviewer.id)).toEqual(
      expectedProfileIds.slice(2, 4),
    );
    expect(secondPage.items.map((row) => row.assignedCount)).toEqual([1, 1]);

    // Totals describe the phase, not the page, so both pages agree.
    expect(firstPage.totalAssignments).toBe(5);
    expect(secondPage.totalAssignments).toBe(5);
    expect(secondPage.totalReviewers).toBe(firstPage.totalReviewers);
    expect(secondPage.totalReviewers).toBeGreaterThanOrEqual(4);
  });

  it('rejects a cursor that did not come from a previous page', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    await expect(
      adminCaller.decision.listPhaseReviewerSummaries({
        processInstanceId: context.instance.instance.id,
        phaseId: 'review',
        cursor: 'not-a-real-cursor',
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });
  });

  it('rejects a reviewer who is not an instance admin', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    const reviewer = await testData.createInstanceReviewerWithRole(context);

    const reviewerCaller = await createAuthenticatedCaller(reviewer.email);

    await expect(
      reviewerCaller.decision.listPhaseReviewerSummaries({
        processInstanceId: context.instance.instance.id,
        phaseId: 'review',
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });

  it('rejects a phaseId that does not exist on the instance', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    await expect(
      adminCaller.decision.listPhaseReviewerSummaries({
        processInstanceId: context.instance.instance.id,
        phaseId: 'this-phase-does-not-exist',
      }),
    ).rejects.toMatchObject({ cause: { name: 'NotFoundError' } });
  });
});

/**
 * Four reviewers carrying 2/1/1/1 assignments. The three ties sort by id.
 */
async function seedPagedReviewers(
  testData: TestReviewsDataManager,
  testId: string,
) {
  const first = await testData.createReviewAssignment({
    title: `Paged proposal A1 ${testId}`,
    status: ProposalReviewAssignmentStatus.PENDING,
  });
  const context = first.context;
  await testData.createReviewAssignment({
    context,
    title: `Paged proposal A2 ${testId}`,
    status: ProposalReviewAssignmentStatus.PENDING,
  });

  const ties = [
    await testData.createInstanceMember(context),
    await testData.createInstanceMember(context),
    await testData.createInstanceMember(context),
  ];

  for (const [reviewer, title] of [
    [ties[0], `Paged proposal N ${testId}`],
    [ties[1], `Paged proposal B ${testId}`],
    [ties[2], `Paged proposal C ${testId}`],
  ] as const) {
    await testData.createReviewAssignment({
      context,
      reviewer,
      title,
      status: ProposalReviewAssignmentStatus.PENDING,
    });
  }

  await testData.setCurrentPhase(context.instance.instance.id, 'review');

  return {
    context,
    expectedProfileIds: [
      context.defaultReviewer.profileId,
      ...ties.map((tie) => tie.profileId).sort(),
    ],
  };
}

describeDecisionAccessTierGating('decision.listPhaseReviewerSummaries', {
  noJwtNonPublic: accessTierGatingCell(
    'rejects no-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestReviewsDataManager(task.id, onTestFinished);
      const context = await testData.createContext();

      const caller = await callers.noJwt();

      await expectFailsAccessTierGate(
        caller.decision.listPhaseReviewerSummaries({
          processInstanceId: context.instance.instance.id,
          phaseId: 'review',
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
        caller.decision.listPhaseReviewerSummaries({
          processInstanceId: context.instance.instance.id,
          phaseId: 'review',
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
        caller.decision.listPhaseReviewerSummaries({
          processInstanceId: context.instance.instance.id,
          phaseId: 'review',
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

      const result = await caller.decision.listPhaseReviewerSummaries({
        processInstanceId: context.instance.instance.id,
        phaseId: 'review',
      });

      expect(result.totalAssignments).toBe(0);
    },
  ),
});
