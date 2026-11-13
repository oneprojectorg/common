import { TestDecisionsDataManager } from '@op/common/testing';
import { db, eq } from '@op/db/client';
import {
  EntityType,
  ProcessStatus,
  processInstances,
  processPhases,
} from '@op/db/schema';
import { ROLES } from '@op/db/seedData/accessControl';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  createUnauthenticatedCaller,
  expectNoProfileNamed,
  listPhaseIds,
  loadBlobPhases,
  loadInstancePhases,
  loadPendingTransitionLinks,
  loadPhaseRows,
  loadTransitionLinks,
  setupPublishedDateDecision,
  setupPublishedDecisionAtThirdPhase,
} from '../../../test/helpers/phaseTestUtils';
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
    const blobPhases = await loadBlobPhases(instanceId);

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
    expect(await loadBlobPhases(instanceId)).toEqual(blobPhases);
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

  it('rejects a member without decisions ADMIN before checking their schema', async ({
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
    const caller = await createAuthenticatedCaller(member.email);

    await expect(
      caller.decision.createPhase({
        instanceId,
        name: 'Voting',
        sortOrder: 0,
        data: { settingsSchema: { type: 'string', minLength: -1 } },
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
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
    const { instanceId, adminCaller } = await setupDecision(
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

    const stored = await db.query.processPhases.findFirst({
      where: { id: phase.id },
      columns: { data: true },
    });
    expect(stored?.data).toEqual({ description: 'Pitch an idea' });
  });

  it('stores a proposal form', async ({ task, onTestFinished }) => {
    const { testData, instanceId, adminCaller } = await setupDecision(
      task,
      onTestFinished,
    );

    const proposalTemplate = {
      type: 'object' as const,
      properties: { title: { type: 'string' as const } },
      required: ['title'],
    };
    const result = await adminCaller.decision.createPhase({
      instanceId,
      name: 'Submissions',
      sortOrder: 0,
      data: { proposalTemplate },
    });
    testData.trackProfileForCleanup(result.profileId);

    const phase = await db.query.processPhases.findFirst({
      where: { id: result.id },
      columns: { data: true },
    });
    expect(phase?.data).toEqual({ proposalTemplate });
  });

  it('refuses a proposal form that is not a valid JSON Schema and creates nothing', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, adminCaller } = await setupDecision(
      task,
      onTestFinished,
    );

    const before = await listPhaseIds(instanceId);

    const name = `Bad Form ${randomUUID()}`;
    await expect(
      adminCaller.decision.createPhase({
        instanceId,
        name,
        sortOrder: 0,
        data: { proposalTemplate: { type: 'string', minLength: -1 } },
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });

    expect(await listPhaseIds(instanceId)).toEqual(before);
    await expectNoProfileNamed(name);
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

  it('gives a decision with no rows a row per blob phase before adding the phase', async ({
    task,
    onTestFinished,
  }) => {
    const { testData, instanceId, adminCaller } = await setupDecision(
      task,
      onTestFinished,
    );
    await testData.removePhaseRows(instanceId);
    const blobPhases = await loadBlobPhases(instanceId);

    const added = await adminCaller.decision.createPhase({
      instanceId,
      name: 'Added',
      sortOrder: 2,
    });
    testData.trackProfileForCleanup(added.profileId);

    const phases = await loadInstancePhases(instanceId);
    expect(phases.map(({ phaseId }) => phaseId)).toEqual([
      'initial',
      'final',
      added.slug,
    ]);
    expect(await loadBlobPhases(instanceId)).toEqual(blobPhases);
  });

  it('refuses a phase after a date-advanced phase with no end date and writes nothing', async ({
    task,
    onTestFinished,
  }) => {
    const { instanceId, adminCaller } = await setupDecision(
      task,
      onTestFinished,
    );
    await db
      .update(processInstances)
      .set({ status: ProcessStatus.PUBLISHED })
      .where(eq(processInstances.id, instanceId));
    const [stored] = (await loadPhaseRows(instanceId)).slice(-1);
    if (!stored) {
      throw new Error('The last phase row was not found');
    }
    const { endDate: _endDate, ...data } = stored.data;
    await db
      .update(processPhases)
      .set({ data: { ...data, rules: { advancement: { method: 'date' } } } })
      .where(eq(processPhases.id, stored.id));

    const before = await listPhaseIds(instanceId);
    expect(before.length).toBeGreaterThan(0);

    const name = `After Date ${randomUUID()}`;
    await expect(
      adminCaller.decision.createPhase({
        instanceId,
        name,
        sortOrder: before.length,
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });

    expect(await listPhaseIds(instanceId)).toEqual(before);
    await expectNoProfileNamed(name);
  });

  it('places a phase added at a taken sortOrder before the phase already there', async ({
    task,
    onTestFinished,
  }) => {
    const { testData, instanceId, adminCaller } = await setupDecision(
      task,
      onTestFinished,
    );
    const existing = await loadPhaseRows(instanceId);
    expect(existing.length).toBeGreaterThan(1);

    const added = await adminCaller.decision.createPhase({
      instanceId,
      name: 'Added',
      sortOrder: 0,
    });
    testData.trackProfileForCleanup(added.profileId);

    expect(added.sortOrder).toBe(0);
    expect(
      (await loadPhaseRows(instanceId)).map(({ id, sortOrder }) => ({
        id,
        sortOrder,
      })),
    ).toEqual(
      [added, ...existing].map(({ id }, sortOrder) => ({ id, sortOrder })),
    );
  });

  it('links a transition to a phase added to a published date decision', async ({
    task,
    onTestFinished,
  }) => {
    const { testData, instanceId, adminCaller, initial, final, endDate } =
      await setupPublishedDateDecision(task, onTestFinished);

    const added = await adminCaller.decision.createPhase({
      instanceId,
      name: 'Added',
      sortOrder: 1,
    });
    testData.trackProfileForCleanup(added.profileId);

    expect(await loadPhaseRows(instanceId)).toMatchObject([
      { id: initial.id },
      { id: added.id },
      { id: final.id },
    ]);
    expect(await loadTransitionLinks(instanceId)).toEqual([
      {
        fromStateId: 'initial',
        toStateId: added.slug,
        fromPhaseId: initial.id,
        toPhaseId: added.id,
        scheduledDate: endDate,
      },
    ]);
  });

  it('schedules no transition out of a phase the decision has left when a phase is inserted before the current one', async ({
    task,
    onTestFinished,
  }) => {
    const { testData, instanceId, adminCaller, rows } =
      await setupPublishedDecisionAtThirdPhase(task, onTestFinished);

    const added = await adminCaller.decision.createPhase({
      instanceId,
      name: 'Added',
      sortOrder: rows.voting.sortOrder,
    });
    testData.trackProfileForCleanup(added.profileId);

    expect(await loadPhaseRows(instanceId)).toMatchObject([
      { id: rows.submission.id },
      { id: rows.review.id },
      { id: added.id },
      { id: rows.voting.id },
      { id: rows.results.id },
    ]);
    expect(await loadPendingTransitionLinks(instanceId)).toEqual([
      {
        fromStateId: 'voting',
        toStateId: 'results',
        fromPhaseId: rows.voting.id,
        toPhaseId: rows.results.id,
      },
    ]);
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

  await expectNoProfileNamed(name);
};
