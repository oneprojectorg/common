import type { ReviewerStatus } from '@op/common/client';
import {
  TestDecisionsDataManager,
  TestReviewsDataManager,
  createProposalReview,
} from '@op/common/testing';
import { db, eq } from '@op/db/client';
import {
  ProposalReviewAssignmentStatus,
  ProposalReviewState,
  profiles,
  proposalReviewAssignments,
} from '@op/db/schema';
import { ROLES } from '@op/db/seedData/accessControl';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
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

/**
 * `behind` has two open assignments (one pending, one ready for re-review)
 * plus a completed and a removed one. `started` has one in progress with a
 * draft. `done` has only completed work. `idle` has none. A reviewer of
 * another instance has an open assignment there.
 */
async function createRecipientsScenario(
  taskId: string,
  onTestFinished: ConstructorParameters<typeof TestReviewsDataManager>[1],
) {
  const testData = new TestReviewsDataManager(taskId, onTestFinished);
  const context = await testData.createContext();

  const behind = await testData.createInstanceMember(context);
  await testData.createReviewAssignment({
    context,
    reviewer: behind,
    title: `Recipients behind pending ${taskId}`,
    status: ProposalReviewAssignmentStatus.PENDING,
  });
  await testData.createReviewAssignment({
    context,
    reviewer: behind,
    title: `Recipients behind re-review ${taskId}`,
    status: ProposalReviewAssignmentStatus.READY_FOR_RE_REVIEW,
  });
  await testData.createReviewAssignment({
    context,
    reviewer: behind,
    title: `Recipients behind completed ${taskId}`,
    status: ProposalReviewAssignmentStatus.COMPLETED,
  });
  const removed = await testData.createReviewAssignment({
    context,
    reviewer: behind,
    title: `Recipients behind removed ${taskId}`,
    status: ProposalReviewAssignmentStatus.PENDING,
  });
  await db
    .update(proposalReviewAssignments)
    .set({ deletedAt: new Date().toISOString() })
    .where(eq(proposalReviewAssignments.id, removed.assignment.id));

  const started = await testData.createInstanceMember(context);
  const startedAssignment = await testData.createReviewAssignment({
    context,
    reviewer: started,
    title: `Recipients started ${taskId}`,
    status: ProposalReviewAssignmentStatus.IN_PROGRESS,
  });
  await createProposalReview({
    assignmentId: startedAssignment.assignment.id,
    state: ProposalReviewState.DRAFT,
    reviewData: { answers: {}, rationales: {} },
  });

  const done = await testData.createInstanceMember(context);
  await testData.createReviewAssignment({
    context,
    reviewer: done,
    title: `Recipients done ${taskId}`,
    status: ProposalReviewAssignmentStatus.COMPLETED,
  });

  const idle = await testData.createInstanceReviewerWithRole(context);

  const foreign = await testData.createReviewAssignment({
    title: `Recipients foreign ${taskId}`,
    status: ProposalReviewAssignmentStatus.PENDING,
  });

  await testData.setCurrentPhase(context.instance.instance.id, 'review');

  const nameToken = `Recipient ${taskId.slice(0, 8)}`;
  const names: Record<string, string> = {
    [behind.profileId]: `${nameToken} Alpha`,
    [started.profileId]: `${nameToken} Bravo`,
    [done.profileId]: `${nameToken} Charlie`,
    [idle.profileId]: `${nameToken} Delta`,
  };
  for (const [profileId, name] of Object.entries(names)) {
    await db.update(profiles).set({ name }).where(eq(profiles.id, profileId));
  }
  const startedDisplayEmail = `bravo-${taskId.slice(0, 8)}@example.org`;
  await db
    .update(profiles)
    .set({ email: startedDisplayEmail })
    .where(eq(profiles.id, started.profileId));

  return {
    startedDisplayEmail,
    context,
    nameToken,
    behind,
    started,
    done,
    idle,
    foreignProfileId: foreign.reviewer.profileId,
  };
}

describe.concurrent('decision.listReviewReminderRecipients', () => {
  it('lists reviewers with open assignments in name order, with their open count', async ({
    task,
    onTestFinished,
  }) => {
    const {
      context,
      nameToken,
      behind,
      started,
      done,
      idle,
      foreignProfileId,
    } = await createRecipientsScenario(task.id, onTestFinished);

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.listReviewReminderRecipients({
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
      search: nameToken,
    });

    expect(result.items).toEqual([
      {
        reviewer: expect.objectContaining({
          id: behind.profileId,
          name: `${nameToken} Alpha`,
        }),
        remainingCount: 2,
      },
      {
        reviewer: expect.objectContaining({
          id: started.profileId,
          name: `${nameToken} Bravo`,
        }),
        remainingCount: 1,
      },
    ]);

    const unfiltered = await adminCaller.decision.listReviewReminderRecipients({
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
    });
    const ids = unfiltered.items.map((row) => row.reviewer.id);
    expect(ids).toContain(behind.profileId);
    expect(ids).not.toContain(done.profileId);
    expect(ids).not.toContain(idle.profileId);
    expect(ids).not.toContain(foreignProfileId);
  });

  it('applies the status filter of the reviewers list', async ({
    task,
    onTestFinished,
  }) => {
    const { context, nameToken, behind, started } =
      await createRecipientsScenario(task.id, onTestFinished);

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );
    const listFor = async (status: ReviewerStatus) =>
      (
        await adminCaller.decision.listReviewReminderRecipients({
          processInstanceId: context.instance.instance.id,
          phaseId: 'review',
          search: nameToken,
          status,
        })
      ).items.map((row) => row.reviewer.id);

    // `behind` has a completed assignment and no draft, so the list shows it
    // in progress; `started` has a draft and nothing submitted.
    expect(await listFor(ProposalReviewAssignmentStatus.IN_PROGRESS)).toEqual([
      behind.profileId,
      started.profileId,
    ]);
    expect(await listFor(ProposalReviewAssignmentStatus.PENDING)).toEqual([]);
    expect(await listFor(ProposalReviewAssignmentStatus.COMPLETED)).toEqual([]);
    expect(await listFor('none')).toEqual([]);
  });

  it('searches by email, and a search that matches nobody returns nothing', async ({
    task,
    onTestFinished,
  }) => {
    const { context, started, startedDisplayEmail } =
      await createRecipientsScenario(task.id, onTestFinished);

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );
    const listFor = async (search: string) =>
      (
        await adminCaller.decision.listReviewReminderRecipients({
          processInstanceId: context.instance.instance.id,
          phaseId: 'review',
          search,
        })
      ).items.map((row) => row.reviewer.id);

    expect(await listFor(startedDisplayEmail.toUpperCase())).toEqual([
      started.profileId,
    ]);
    expect(await listFor(`no-such-reviewer-${task.id}`)).toEqual([]);
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
      reviewerCaller.decision.listReviewReminderRecipients({
        processInstanceId: context.instance.instance.id,
        phaseId: 'review',
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });

  it('rejects an org admin with no grant on the instance profile', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();

    const decisions = new TestDecisionsDataManager(task.id, onTestFinished);
    const orgAdmin = await decisions.createMemberUser({
      organization: context.organization,
      orgRoleId: ROLES.ADMIN.id,
    });

    const caller = await createAuthenticatedCaller(orgAdmin.email);

    await expect(
      caller.decision.listReviewReminderRecipients({
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
      adminCaller.decision.listReviewReminderRecipients({
        processInstanceId: context.instance.instance.id,
        phaseId: 'this-phase-does-not-exist',
      }),
    ).rejects.toMatchObject({ cause: { name: 'NotFoundError' } });
  });
});

describeDecisionAccessTierGating('decision.listReviewReminderRecipients', {
  noJwtNonPublic: accessTierGatingCell(
    'rejects no-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestReviewsDataManager(task.id, onTestFinished);
      const context = await testData.createContext();

      const caller = await callers.noJwt();

      await expectFailsAccessTierGate(
        caller.decision.listReviewReminderRecipients({
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
        caller.decision.listReviewReminderRecipients({
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
        caller.decision.listReviewReminderRecipients({
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

      const result = await caller.decision.listReviewReminderRecipients({
        processInstanceId: context.instance.instance.id,
        phaseId: 'review',
      });

      expect(result.items).toEqual([]);
    },
  ),
});
