import { db, eq } from '@op/db/client';
import {
  decisionProcessSurveyResponses,
  decisionProcessSurveySubmitters,
} from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { appRouter } from '..';
import { TestDecisionsDataManager } from '../../test/helpers/TestDecisionsDataManager';
import {
  accessTierGatingCell,
  describeDecisionAccessTierGating,
  expectFailsAccessTierGate,
} from '../../test/helpers/gating/decision';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../test/supabase-utils';
import { createCallerFactory } from '../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

const createAuthenticatedCaller = async (email: string) => {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
};

const sampleInternalData = {
  wasAdmin: false,
  npsScore: 9,
  completedAt: '2026-05-20T12:00:00.000Z',
  promoterReasons: ['easy_to_use'],
  additionalFeedback: 'Loved it.',
};

describe.concurrent('process survey submission', () => {
  it('rejects a user without decision READ access on the instance profile', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 1 });
    const { instance } = setup.instance;

    const outsiderSetup = await testData.createDecisionSetup({
      instanceCount: 0,
    });
    const outsider = await testData.createMemberUser({
      organization: outsiderSetup.organization,
      instanceProfileIds: [],
    });
    const outsiderCaller = await createAuthenticatedCaller(outsider.email);

    await expect(
      outsiderCaller.decision.submitProcessSurveyResponse({
        processInstanceId: instance.id,
        internalData: sampleInternalData,
        locale: 'en',
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });

    const responses = await db
      .select({ id: decisionProcessSurveyResponses.id })
      .from(decisionProcessSurveyResponses)
      .where(eq(decisionProcessSurveyResponses.processInstanceId, instance.id));
    expect(responses).toHaveLength(0);
  });

  it('records a submission once and is idempotent on retry', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const { instance } = setup.instance;

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const first = await caller.decision.submitProcessSurveyResponse({
      processInstanceId: instance.id,
      internalData: sampleInternalData,
      locale: 'en',
    });
    expect(first.hasResponded).toBe(true);

    const second = await caller.decision.submitProcessSurveyResponse({
      processInstanceId: instance.id,
      internalData: { ...sampleInternalData, npsScore: 3 },
      locale: 'en',
    });
    expect(second.hasResponded).toBe(true);

    const responses = await db
      .select({
        id: decisionProcessSurveyResponses.id,
        internalData: decisionProcessSurveyResponses.internalData,
      })
      .from(decisionProcessSurveyResponses)
      .where(eq(decisionProcessSurveyResponses.processInstanceId, instance.id));
    expect(responses).toHaveLength(1);
    expect(responses[0]?.internalData).toMatchObject({ npsScore: 9 });

    const submitters = await db
      .select({ id: decisionProcessSurveySubmitters.id })
      .from(decisionProcessSurveySubmitters)
      .where(
        eq(decisionProcessSurveySubmitters.processInstanceId, instance.id),
      );
    expect(submitters).toHaveLength(1);
  });

  it('stores response with no submitter FK on the response row', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const { instance } = setup.instance;

    const caller = await createAuthenticatedCaller(setup.userEmail);
    await caller.decision.submitProcessSurveyResponse({
      processInstanceId: instance.id,
      internalData: sampleInternalData,
      locale: 'en',
    });

    const [response] = await db
      .select()
      .from(decisionProcessSurveyResponses)
      .where(eq(decisionProcessSurveyResponses.processInstanceId, instance.id))
      .limit(1);
    expect(response).toBeDefined();
    expect(response).not.toHaveProperty('submittedByProfileId');
  });

  it('getProcessSurveyResponse reflects whether the caller has submitted', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const { instance } = setup.instance;

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const before = await caller.decision.getProcessSurveyResponse({
      processInstanceId: instance.id,
    });
    expect(before.hasResponded).toBe(false);

    await caller.decision.submitProcessSurveyResponse({
      processInstanceId: instance.id,
      internalData: sampleInternalData,
      locale: 'en',
    });

    const after = await caller.decision.getProcessSurveyResponse({
      processInstanceId: instance.id,
    });
    expect(after.hasResponded).toBe(true);
  });
});

describeDecisionAccessTierGating('submitProcessSurveyResponse', {
  noJwtNonPublic: accessTierGatingCell(
    'rejects no-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const { instance } = setup.instance;

      const caller = await callers.noJwt();

      await expectFailsAccessTierGate(
        caller.decision.submitProcessSurveyResponse({
          processInstanceId: instance.id,
          internalData: sampleInternalData,
          locale: 'en',
        }),
        'none',
      );
    },
  ),

  anonJwtNonPublic: accessTierGatingCell(
    'rejects anon-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const { instance } = setup.instance;

      const caller = await callers.anonJwt();

      await expectFailsAccessTierGate(
        caller.decision.submitProcessSurveyResponse({
          processInstanceId: instance.id,
          internalData: sampleInternalData,
          locale: 'en',
        }),
        'anon',
      );
    },
  ),

  userJwtNonPublic: accessTierGatingCell(
    'rejects user-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const { instance } = setup.instance;

      const caller = await callers.userJwt();

      await expectFailsAccessTierGate(
        caller.decision.submitProcessSurveyResponse({
          processInstanceId: instance.id,
          internalData: sampleInternalData,
          locale: 'en',
        }),
        'user',
      );
    },
  ),

  networkJwtNonPublic: accessTierGatingCell(
    'admits network-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const { instance } = setup.instance;

      const caller = await callers.networkJwt(setup.userEmail);

      const result = await caller.decision.submitProcessSurveyResponse({
        processInstanceId: instance.id,
        internalData: sampleInternalData,
        locale: 'en',
      });

      expect(result.hasResponded).toBe(true);
    },
  ),
});

describeDecisionAccessTierGating('getProcessSurveyResponse', {
  noJwtNonPublic: accessTierGatingCell(
    'rejects no-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const { instance } = setup.instance;

      const caller = await callers.noJwt();

      await expectFailsAccessTierGate(
        caller.decision.getProcessSurveyResponse({
          processInstanceId: instance.id,
        }),
        'none',
      );
    },
  ),

  anonJwtNonPublic: accessTierGatingCell(
    'rejects anon-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const { instance } = setup.instance;

      const caller = await callers.anonJwt();

      await expectFailsAccessTierGate(
        caller.decision.getProcessSurveyResponse({
          processInstanceId: instance.id,
        }),
        'anon',
      );
    },
  ),

  userJwtNonPublic: accessTierGatingCell(
    'rejects user-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const { instance } = setup.instance;

      const caller = await callers.userJwt();

      await expectFailsAccessTierGate(
        caller.decision.getProcessSurveyResponse({
          processInstanceId: instance.id,
        }),
        'user',
      );
    },
  ),

  networkJwtNonPublic: accessTierGatingCell(
    'admits network-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const { instance } = setup.instance;

      const caller = await callers.networkJwt(setup.userEmail);

      const result = await caller.decision.getProcessSurveyResponse({
        processInstanceId: instance.id,
      });

      expect(result).toBeDefined();
    },
  ),
});
