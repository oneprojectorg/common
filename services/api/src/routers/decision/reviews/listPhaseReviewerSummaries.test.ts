import {
  ProposalReviewAssignmentStatus,
  ProposalReviewState,
  profiles,
  proposals,
} from '@op/db/schema';
import { db } from '@op/db/test';
import { createProposalReview } from '@op/test';
import { eq } from 'drizzle-orm';
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
  it('aggregates per-reviewer counts and the last submission', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: `Counted proposal ${task.id}`,
      status: ProposalReviewAssignmentStatus.IN_PROGRESS,
    });
    const context = created.context;
    await testData.setCurrentPhase(context.instance.instance.id, 'review');

    const submittedAt = new Date().toISOString();
    await createProposalReview({
      assignmentId: created.assignment.id,
      state: ProposalReviewState.SUBMITTED,
      reviewData: { answers: {}, rationales: {} },
      submittedAt,
    });

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.listPhaseReviewerSummaries({
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
    });

    expect(result.totalAssignments).toBe(1);
    const summary = result.reviewers.find(
      (candidate) =>
        candidate.reviewer.id === context.defaultReviewer.profileId,
    );
    expect(summary?.assignedCount).toBe(1);
    expect(summary?.submittedCount).toBe(1);
    expect(summary?.draftCount).toBe(0);
    expect(summary?.lastSubmittedAt).not.toBeNull();
  });

  it('counts a draft review separately from a submitted one', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: `Drafted proposal ${task.id}`,
      status: ProposalReviewAssignmentStatus.IN_PROGRESS,
    });
    const context = created.context;
    await testData.setCurrentPhase(context.instance.instance.id, 'review');

    await createProposalReview({
      assignmentId: created.assignment.id,
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

    const summary = result.reviewers.find(
      (candidate) =>
        candidate.reviewer.id === context.defaultReviewer.profileId,
    );
    expect(summary?.assignedCount).toBe(1);
    expect(summary?.draftCount).toBe(1);
    expect(summary?.submittedCount).toBe(0);
    expect(summary?.lastSubmittedAt).toBeNull();
  });

  it('lists a reviewer holding the role but carrying nothing yet', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    const idle = await testData.createInstanceReviewerWithRole(context);

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.listPhaseReviewerSummaries({
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
    });

    const summary = result.reviewers.find(
      (candidate) => candidate.reviewer.id === idle.profileId,
    );
    expect(summary?.assignedCount).toBe(0);
    expect(result.totalAssignments).toBe(0);
  });

  it('orders by assigned count, then name, with idle reviewers last', async ({
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

    const tieEarly = await testData.createInstanceMember(context);
    const tieLate = await testData.createInstanceMember(context);
    await testData.createReviewAssignment({
      context,
      reviewer: tieEarly,
      title: `Ordered proposal B ${task.id}`,
      status: ProposalReviewAssignmentStatus.PENDING,
    });
    const tieLateAssignment = await testData.createReviewAssignment({
      context,
      reviewer: tieLate,
      title: `Ordered proposal C ${task.id}`,
      status: ProposalReviewAssignmentStatus.PENDING,
    });
    const idle = await testData.createInstanceReviewerWithRole(context);
    await testData.setCurrentPhase(context.instance.instance.id, 'review');

    await createProposalReview({
      assignmentId: tieLateAssignment.assignment.id,
      state: ProposalReviewState.SUBMITTED,
      reviewData: { answers: {}, rationales: {} },
      submittedAt: new Date().toISOString(),
    });

    const named = [
      [context.defaultReviewer.profileId, `A two ${task.id}`],
      [tieEarly.profileId, `B one ${task.id}`],
      [tieLate.profileId, `C one ${task.id}`],
      [idle.profileId, `D idle ${task.id}`],
    ] as const;
    for (const [profileId, name] of named) {
      await db.update(profiles).set({ name }).where(eq(profiles.id, profileId));
    }

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );
    const result = await adminCaller.decision.listPhaseReviewerSummaries({
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
    });

    const expected = named.map(([, name]) => name);
    const names = result.reviewers
      .map((summary) => summary.reviewer.name)
      .filter((name): name is string =>
        (expected as readonly (string | null)[]).includes(name),
      );
    expect(names).toEqual(expected);
  });

  it('pages through the reviewers in order without repeating or skipping one', async ({
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

    expect(firstPage.reviewers.map((row) => row.reviewer.id)).toEqual(
      expectedProfileIds.slice(0, 2),
    );
    expect(firstPage.reviewers.map((row) => row.assignedCount)).toEqual([2, 1]);
    expect(firstPage.reviewers[1]?.reviewer.name).toBe('');
    expect(firstPage.next).not.toBeNull();

    const secondPage = await adminCaller.decision.listPhaseReviewerSummaries({
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
      limit: 2,
      cursor: firstPage.next,
    });

    expect(secondPage.reviewers.map((row) => row.reviewer.id)).toEqual(
      expectedProfileIds.slice(2, 4),
    );
    expect(secondPage.reviewers.map((row) => row.assignedCount)).toEqual([
      1, 1,
    ]);
  });

  it('reports phase-wide totals on every page, not the page it returns', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const seeded = await seedPagedReviewers(testData, task.id);
    const { context } = seeded;

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const firstPage = await adminCaller.decision.listPhaseReviewerSummaries({
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
      limit: 2,
    });
    const secondPage = await adminCaller.decision.listPhaseReviewerSummaries({
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
      limit: 2,
      cursor: firstPage.next,
    });

    expect(firstPage.totalAssignments).toBe(5);
    expect(secondPage.totalAssignments).toBe(5);
    expect(secondPage.totalReviewers).toBe(firstPage.totalReviewers);
    expect(secondPage.totalReviewers).toBeGreaterThanOrEqual(4);
    expect(secondPage.reviewers).toHaveLength(2);
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

  it('excludes assignments whose proposal was moderation-detached', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: `Detached proposal ${task.id}`,
      status: ProposalReviewAssignmentStatus.PENDING,
    });
    const context = created.context;
    await testData.setCurrentPhase(context.instance.instance.id, 'review');

    await db
      .update(proposals)
      .set({ moderationDetachedAt: new Date().toISOString() })
      .where(eq(proposals.id, created.proposal.id));

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.listPhaseReviewerSummaries({
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
    });

    expect(result.totalAssignments).toBe(0);
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
 * Four reviewers carrying 2/1/1/1 assignments, one seeded with an empty name:
 * `profiles.name` is NOT NULL, so '' is the lowest key the COALESCE folds onto.
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

  const nameless = await testData.createInstanceMember(context);
  const tieEarly = await testData.createInstanceMember(context);
  const tieLate = await testData.createInstanceMember(context);

  for (const [reviewer, title] of [
    [nameless, `Paged proposal N ${testId}`],
    [tieEarly, `Paged proposal B ${testId}`],
    [tieLate, `Paged proposal C ${testId}`],
  ] as const) {
    await testData.createReviewAssignment({
      context,
      reviewer,
      title,
      status: ProposalReviewAssignmentStatus.PENDING,
    });
  }

  await testData.setCurrentPhase(context.instance.instance.id, 'review');

  const named: ReadonlyArray<readonly [string, string]> = [
    [context.defaultReviewer.profileId, `A pager ${testId}`],
    [nameless.profileId, ''],
    [tieEarly.profileId, `B pager ${testId}`],
    [tieLate.profileId, `C pager ${testId}`],
  ];
  for (const [profileId, name] of named) {
    await db.update(profiles).set({ name }).where(eq(profiles.id, profileId));
  }

  return {
    context,
    expectedProfileIds: named.map(([profileId]) => profileId),
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
