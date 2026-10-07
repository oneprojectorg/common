import { TestDecisionsDataManager } from '@op/common/testing';
import { db } from '@op/db/client';
import { EntityType } from '@op/db/schema';
import { ROLES } from '@op/db/seedData/accessControl';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { createUnauthenticatedCaller } from '../../../test/helpers/phaseTestUtils';
import { createAuthenticatedCaller } from '../../../test/supabase-utils';

type OnTestFinished = (fn: () => void | Promise<void>) => void;
type Caller = Awaited<ReturnType<typeof createAuthenticatedCaller>>;

describe.concurrent('createPhase', () => {
  it('creates a phase and its profile as a decision admin', async ({
    task,
    onTestFinished,
  }) => {
    const { testData, instanceId, adminCaller } = await setupDecision(
      task,
      onTestFinished,
    );

    const result = await adminCaller.decision.createPhase({
      instanceId,
      name: 'Submissions',
      sortOrder: 0,
      data: { description: 'Pitch an idea' },
    });
    testData.trackProfileForCleanup(result.profileId);

    expect(result).toMatchObject({
      processInstanceId: instanceId,
      sortOrder: 0,
      name: 'Submissions',
    });

    const [phase, profile] = await Promise.all([
      db.query.processPhases.findFirst({ where: { id: result.id } }),
      db.query.profiles.findFirst({ where: { id: result.profileId } }),
    ]);
    expect(phase?.data).toEqual({ description: 'Pitch an idea' });
    expect(profile?.type).toBe(EntityType.PHASE);
    expect(profile?.slug).toBe(result.slug);
  });

  it('lets a second user granted decisions ADMIN create a phase', async ({
    task,
    onTestFinished,
  }) => {
    const { testData, setup, instanceId } = await setupDecision(
      task,
      onTestFinished,
    );

    const admin = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [setup.instance.profileId],
    });
    await testData.grantProfileAccess(
      setup.instance.profileId,
      admin.authUserId,
      admin.email,
      true,
    );
    const caller = await createAuthenticatedCaller(admin.email);

    const result = await caller.decision.createPhase({
      instanceId,
      name: 'Submissions',
      sortOrder: 0,
    });
    testData.trackProfileForCleanup(result.profileId);

    expect(result.processInstanceId).toBe(instanceId);
  });

  it('rejects a member without decisions ADMIN', async ({
    task,
    onTestFinished,
  }) => {
    const { testData, setup, instanceId } = await setupDecision(
      task,
      onTestFinished,
    );

    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [setup.instance.profileId],
    });

    await expectRejectedAndNothingWritten(
      await createAuthenticatedCaller(member.email),
      instanceId,
    );
  });

  it('rejects an org admin without a decision grant', async ({
    task,
    onTestFinished,
  }) => {
    const { testData, setup, instanceId } = await setupDecision(
      task,
      onTestFinished,
    );

    const orgAdmin = await testData.createMemberUser({
      organization: setup.organization,
      orgRoleId: ROLES.ADMIN.id,
    });

    await expectRejectedAndNothingWritten(
      await createAuthenticatedCaller(orgAdmin.email),
      instanceId,
    );
  });

  it('rejects the admin of a different decision', async ({
    task,
    onTestFinished,
  }) => {
    const { testData, instanceId } = await setupDecision(task, onTestFinished);
    const other = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    await expectRejectedAndNothingWritten(
      await createAuthenticatedCaller(other.userEmail),
      instanceId,
    );
  });

  it('rejects a user with no access to the decision', async ({
    task,
    onTestFinished,
  }) => {
    const { testData, instanceId } = await setupDecision(task, onTestFinished);
    const outsider = await testData.createDecisionSetup({
      instanceCount: 0,
      grantAccess: false,
    });

    await expectRejectedAndNothingWritten(
      await createAuthenticatedCaller(outsider.userEmail),
      instanceId,
    );
  });

  it('returns not found for an unknown instance', async ({
    task,
    onTestFinished,
  }) => {
    const { adminCaller } = await setupDecision(task, onTestFinished);

    await expect(
      adminCaller.decision.createPhase({
        instanceId: randomUUID(),
        name: 'Submissions',
        sortOrder: 0,
      }),
    ).rejects.toMatchObject({ cause: { name: 'NotFoundError' } });
  });

  it('rejects a sortOrder that does not fit the column', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, adminCaller } = await setupDecision(
      task,
      onTestFinished,
    );

    await expect(
      adminCaller.decision.createPhase({
        instanceId,
        name: 'Submissions',
        sortOrder: 2 ** 31,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('rejects an empty name and an invalid startDate', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, adminCaller } = await setupDecision(
      task,
      onTestFinished,
    );

    await expect(
      adminCaller.decision.createPhase({
        instanceId,
        name: '  ',
        sortOrder: 0,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    await expect(
      adminCaller.decision.createPhase({
        instanceId,
        name: 'Submissions',
        sortOrder: 0,
        data: { startDate: 'tomorrow' },
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('accepts a null headline, rubric and proposal form and stores none', async ({
    task,
    onTestFinished,
  }) => {
    const { testData, instanceId, adminCaller } = await setupDecision(
      task,
      onTestFinished,
    );

    const phase = await adminCaller.decision.createPhase({
      instanceId,
      name: 'Submissions',
      sortOrder: 0,
      data: {
        description: 'Pitch an idea',
        headline: null,
        rubricTemplate: null,
        proposalTemplate: null,
      },
    });
    testData.trackProfileForCleanup(phase.profileId);

    const stored = await db.query.processPhases.findFirst({
      where: { id: phase.id },
      columns: { data: true },
    });
    expect(stored?.data).toEqual({ description: 'Pitch an idea' });
  });

  it('accepts a settings schema, settings and a pipeline from the client', async ({
    task,
    onTestFinished,
  }) => {
    const { testData, instanceId, adminCaller } = await setupDecision(
      task,
      onTestFinished,
    );

    const data = {
      settingsSchema: {
        type: 'object' as const,
        properties: { budget: { type: 'number' as const, minimum: 0 } },
      },
      settings: { budget: 50000 },
      selectionPipeline: {
        version: '1.0.0',
        blocks: [
          {
            id: 'funded',
            type: 'filter' as const,
            condition: {
              operator: 'greaterThan' as const,
              left: { field: 'voteData.approvalRate' },
              right: { value: 0.5 },
            },
          },
        ],
      },
    };
    const result = await adminCaller.decision.createPhase({
      instanceId,
      name: 'Voting',
      sortOrder: 0,
      data,
    });
    testData.trackProfileForCleanup(result.profileId);

    const phase = await db.query.processPhases.findFirst({
      where: { id: result.id },
    });
    expect(phase?.data).toEqual(data);
  });

  it('rejects settings without a schema and a pipeline block no executor handles', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, adminCaller } = await setupDecision(
      task,
      onTestFinished,
    );

    await expect(
      adminCaller.decision.createPhase({
        instanceId,
        name: 'Voting',
        sortOrder: 0,
        data: { settings: { budget: 50000 } },
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });

    await expect(
      adminCaller.decision.createPhase({
        instanceId,
        name: 'Voting',
        sortOrder: 0,
        data: {
          selectionPipeline: {
            version: '1.0.0',
            // @ts-expect-error not a block type
            blocks: [{ id: 'top', type: 'limt', count: 3 }],
          },
        },
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('requires authentication', async () => {
    const caller = await createUnauthenticatedCaller();

    await expect(
      caller.decision.createPhase({
        instanceId: randomUUID(),
        name: 'Submissions',
        sortOrder: 0,
      }),
    ).rejects.toMatchObject({
      cause: { name: 'AccessTierError', callerTier: 'none' },
    });
  });
});

const setupDecision = async (
  task: { id: string },
  onTestFinished: OnTestFinished,
) => {
  const testData = new TestDecisionsDataManager(task.id, onTestFinished);
  const setup = await testData.createDecisionSetup({
    instanceCount: 1,
    grantAccess: true,
  });

  return {
    testData,
    setup,
    instanceId: setup.instance.instance.id,
    adminCaller: await createAuthenticatedCaller(setup.userEmail),
  };
};

const expectRejectedAndNothingWritten = async (
  caller: Caller,
  instanceId: string,
) => {
  const name = `Forbidden ${randomUUID()}`;

  await expect(
    caller.decision.createPhase({
      instanceId,
      name,
      sortOrder: 0,
    }),
  ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });

  const leftover = await db.query.profiles.findMany({
    where: { name },
    columns: { id: true },
  });
  expect(leftover).toHaveLength(0);
};
