import {
  TestDecisionsDataManager,
  TestReviewsDataManager,
} from '@op/common/testing';
import { ROLES } from '@op/db/seedData/accessControl';
import { Events, event } from '@op/events';
import { describe, expect, it, vi } from 'vitest';

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

const message = 'Hi {{firstName}}, you have {{proposalsLeft}} left.';

describe('decision.sendReviewReminder', () => {
  // Reads the shared `event.send` mock, which a concurrent sibling would clear.
  it.sequential('enqueues one event with the unique reviewer ids for a decisions admin', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    const reviewer = await testData.createInstanceReviewerWithRole(context);
    const processInstanceId = context.instance.instance.id;
    await testData.setCurrentPhase(processInstanceId, 'review');

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.sendReviewReminder({
      processInstanceId,
      phaseId: 'review',
      reviewerProfileIds: [
        reviewer.profileId,
        context.defaultReviewer.profileId,
        reviewer.profileId,
      ],
      message: `  ${message}  `,
    });

    const sent = vi
      .mocked(event.send)
      .mock.calls.flatMap(([payload]) =>
        Array.isArray(payload) ? payload : [payload],
      )
      .filter(
        (payload) =>
          payload.name === Events.reviewReminderRequested.name &&
          payload.data.batchId === result.batchId,
      );

    expect(sent).toEqual([
      {
        name: Events.reviewReminderRequested.name,
        data: {
          batchId: result.batchId,
          processInstanceId,
          phaseId: 'review',
          reviewerProfileIds: [
            reviewer.profileId,
            context.defaultReviewer.profileId,
          ],
          message,
        },
      },
    ]);
  });
});

describe.concurrent('decision.sendReviewReminder access', () => {
  it('rejects a reviewer who is not a decisions admin', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    const reviewer = await testData.createInstanceReviewerWithRole(context);

    const reviewerCaller = await createAuthenticatedCaller(reviewer.email);

    await expect(
      reviewerCaller.decision.sendReviewReminder({
        processInstanceId: context.instance.instance.id,
        phaseId: 'review',
        reviewerProfileIds: [reviewer.profileId],
        message,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });

  it('rejects an org admin with no grant on the instance profile', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();

    // Org Admin with no role on the instance profile: no org fallback here.
    const decisions = new TestDecisionsDataManager(task.id, onTestFinished);
    const orgAdmin = await decisions.createMemberUser({
      organization: context.organization,
      orgRoleId: ROLES.ADMIN.id,
    });

    const caller = await createAuthenticatedCaller(orgAdmin.email);

    await expect(
      caller.decision.sendReviewReminder({
        processInstanceId: context.instance.instance.id,
        phaseId: 'review',
        reviewerProfileIds: [context.defaultReviewer.profileId],
        message,
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
      adminCaller.decision.sendReviewReminder({
        processInstanceId: context.instance.instance.id,
        phaseId: 'this-phase-does-not-exist',
        reviewerProfileIds: [context.defaultReviewer.profileId],
        message,
      }),
    ).rejects.toMatchObject({ cause: { name: 'NotFoundError' } });
  });

  it('rejects a phase that exists but is not current', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    // The context starts in 'submission'; 'review' is a later phase.
    await expect(
      adminCaller.decision.sendReviewReminder({
        processInstanceId: context.instance.instance.id,
        phaseId: 'review',
        reviewerProfileIds: [context.defaultReviewer.profileId],
        message,
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });
  });

  it('rejects a message that is empty after trimming', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    await expect(
      adminCaller.decision.sendReviewReminder({
        processInstanceId: context.instance.instance.id,
        phaseId: 'review',
        reviewerProfileIds: [context.defaultReviewer.profileId],
        message: '   ',
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});

describeDecisionAccessTierGating('decision.sendReviewReminder', {
  noJwtNonPublic: accessTierGatingCell(
    'rejects no-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestReviewsDataManager(task.id, onTestFinished);
      const context = await testData.createContext();

      const caller = await callers.noJwt();

      await expectFailsAccessTierGate(
        caller.decision.sendReviewReminder({
          processInstanceId: context.instance.instance.id,
          phaseId: 'review',
          reviewerProfileIds: [context.defaultReviewer.profileId],
          message,
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
        caller.decision.sendReviewReminder({
          processInstanceId: context.instance.instance.id,
          phaseId: 'review',
          reviewerProfileIds: [context.defaultReviewer.profileId],
          message,
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
        caller.decision.sendReviewReminder({
          processInstanceId: context.instance.instance.id,
          phaseId: 'review',
          reviewerProfileIds: [context.defaultReviewer.profileId],
          message,
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

      // Assert it lands: "not Unauthorized" would pass if it never ran.
      const result = await caller.decision.sendReviewReminder({
        processInstanceId: context.instance.instance.id,
        phaseId: 'review',
        reviewerProfileIds: [context.defaultReviewer.profileId],
        message,
      });

      expect(result.batchId).toMatch(/^[0-9a-f-]{36}$/);
    },
  ),
});
