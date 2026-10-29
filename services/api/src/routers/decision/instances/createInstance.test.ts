import {
  type DecisionInstanceData,
  MAX_PHASES_PER_DECISION,
  PROCESS_NAME_MAX_LENGTH,
  PROCESS_NAME_MIN_LENGTH,
} from '@op/common';
import { TestDecisionsDataManager } from '@op/common/testing';
import { asc, db, eq } from '@op/db/client';
import { processPhases, profiles } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import {
  accessTierGatingCell,
  describeDecisionAccessTierGating,
  expectFailsAccessTierGate,
} from '../../../test/helpers/gating/decision';
import { createAuthenticatedCaller } from '../../../test/supabase-utils';

const grantDraft = {
  type: 'grant' as const,
  phases: [
    { kind: 'submissions' as const, name: 'Send your application' },
    { kind: 'review' as const, name: 'Review and decide' },
    { kind: 'results' as const, name: 'See awards' },
  ],
};

async function loadInstanceData(instanceId: string) {
  const instance = await db.query.processInstances.findFirst({
    where: { id: instanceId },
  });

  if (!instance) {
    throw new Error(`Instance ${instanceId} was not created`);
  }

  return {
    instance,
    instanceData: instance.instanceData as DecisionInstanceData,
  };
}

async function loadPhaseRows(processInstanceId: string) {
  return db
    .select({
      sortOrder: processPhases.sortOrder,
      data: processPhases.data,
      name: profiles.name,
    })
    .from(processPhases)
    .innerJoin(profiles, eq(profiles.id, processPhases.profileId))
    .where(eq(processPhases.processInstanceId, processInstanceId))
    .orderBy(asc(processPhases.sortOrder));
}

describe.concurrent('createInstance', () => {
  it('creates a draft from the phases it is given', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 0 });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.createInstance({
      ...grantDraft,
      name: `  Grant ${task.id}  `,
    });
    testData.trackProfileForCleanup(result.id);

    expect(result.name).toBe(`Grant ${task.id}`);
    expect(result.processInstance.status).toBe('draft');

    const { instance, instanceData } = await loadInstanceData(
      result.processInstance.id,
    );

    expect(instanceData.phases.map((phase) => phase.name)).toEqual([
      'Send your application',
      'Review and decide',
      'See awards',
    ]);
    expect(instanceData.phases[0]?.rules?.proposals?.submit).toBe(true);
    expect(instanceData.phases[1]?.rules?.reviews?.submit).toBe(true);
    expect(instanceData.templateId).toBe('composed:grant');
    expect(instanceData.proposalTemplate).toBeUndefined();
    expect(instance.currentStateId).toBe(instanceData.phases[0]?.phaseId);
  });

  it('mints a phase row and profile per phase it is given', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 0 });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.createInstance({
      ...grantDraft,
      name: `Grant Rows ${task.id}`,
    });
    testData.trackProfileForCleanup(result.id);

    const [{ instanceData }, rows] = await Promise.all([
      loadInstanceData(result.processInstance.id),
      loadPhaseRows(result.processInstance.id),
    ]);

    expect(rows).toHaveLength(grantDraft.phases.length);
    instanceData.phases.forEach((phase, index) => {
      const row = rows[index]!;
      expect(row.sortOrder).toBe(index);
      expect(row.name).toBe(grantDraft.phases[index]!.name);
      expect(row.data).toMatchObject({ phaseId: phase.phaseId });
    });
  });

  it('creates a blank draft with no phases', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 0 });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.createInstance({
      name: `Blank ${task.id}`,
      type: 'other',
      phases: [],
    });
    testData.trackProfileForCleanup(result.id);

    const { instance, instanceData } = await loadInstanceData(
      result.processInstance.id,
    );

    expect(instanceData.phases).toEqual([]);
    expect(instance.currentStateId).toBeNull();
    expect(await loadPhaseRows(result.processInstance.id)).toHaveLength(0);
  });

  it('is stewarded by the profile the creator is acting as', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 0 });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.createInstance({
      ...grantDraft,
      name: `Steward ${task.id}`,
    });
    testData.trackProfileForCleanup(result.id);

    const { instance } = await loadInstanceData(result.processInstance.id);

    expect(instance.stewardProfileId).toBe(setup.organization.profileId);
  });

  it('rejects a phase kind it does not offer', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 0 });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.decision.createInstance({
        ...grantDraft,
        name: `Bad kind ${task.id}`,
        // @ts-expect-error -- the kind enum is the contract under test
        phases: [{ kind: 'deliberation', name: 'Talk it over' }],
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it.for([
    {
      label: 'a name at the minimum length',
      name: 'a'.repeat(PROCESS_NAME_MIN_LENGTH),
      phases: grantDraft.phases,
    },
    {
      label: 'a name at the maximum length',
      name: 'a'.repeat(PROCESS_NAME_MAX_LENGTH),
      phases: grantDraft.phases,
    },
    {
      label: 'as many phases as a decision can hold',
      name: 'Most phases',
      phases: Array.from({ length: MAX_PHASES_PER_DECISION }, () => ({
        kind: 'submissions' as const,
        name: 'Ideas',
      })),
    },
  ])('accepts $label', async ({ name, phases }, { task, onTestFinished }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 0 });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.createInstance({
      ...grantDraft,
      name,
      phases,
    });
    testData.trackProfileForCleanup(result.id);

    expect(result.processInstance.status).toBe('draft');
  });

  it.for([
    { label: 'shorter than the minimum once trimmed', name: '  ab  ' },
    {
      label: 'longer than the maximum',
      name: 'a'.repeat(PROCESS_NAME_MAX_LENGTH + 1),
    },
  ])('rejects a name $label', async ({ name }, { task, onTestFinished }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 0 });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.decision.createInstance({ ...grantDraft, name }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it.for([
    {
      label: 'more phases than a decision can hold',
      phases: Array.from({ length: MAX_PHASES_PER_DECISION + 1 }, () => ({
        kind: 'submissions' as const,
        name: 'Ideas',
      })),
    },
    {
      label: 'a blank phase name',
      phases: [{ kind: 'submissions' as const, name: '   ' }],
    },
  ])('rejects $label', async ({ phases }, { task, onTestFinished }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 0 });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.decision.createInstance({
        ...grantDraft,
        name: `Phases ${task.id}`,
        phases,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('links no process template', async ({ task, onTestFinished }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 0 });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.createInstance({
      ...grantDraft,
      name: `Templateless ${task.id}`,
    });
    testData.trackProfileForCleanup(result.id);

    const { instance } = await loadInstanceData(result.processInstance.id);

    expect(instance.processId).toBeNull();
  });
});

describeDecisionAccessTierGating('createInstance', {
  noJwtNonPublic: accessTierGatingCell(
    'rejects no-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      await testData.createDecisionSetup({ instanceCount: 0 });

      const caller = await callers.noJwt();

      await expectFailsAccessTierGate(
        caller.decision.createInstance({
          ...grantDraft,
          name: `no-JWT ${task.id}`,
        }),
        'none',
      );
    },
  ),

  anonJwtNonPublic: accessTierGatingCell(
    'rejects anon-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      await testData.createDecisionSetup({ instanceCount: 0 });

      const caller = await callers.anonJwt();

      await expectFailsAccessTierGate(
        caller.decision.createInstance({
          ...grantDraft,
          name: `anon ${task.id}`,
        }),
        'anon',
      );
    },
  ),

  userJwtNonPublic: accessTierGatingCell(
    'rejects out-of-network user-JWT caller',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      await testData.createDecisionSetup({ instanceCount: 0 });

      const caller = await callers.userJwt();

      await expectFailsAccessTierGate(
        caller.decision.createInstance({
          ...grantDraft,
          name: `user ${task.id}`,
        }),
        'user',
      );
    },
  ),

  networkJwtNonPublic: accessTierGatingCell(
    'admits network-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({ instanceCount: 0 });

      const caller = await callers.networkJwt(setup.userEmail);

      const result = await caller.decision.createInstance({
        ...grantDraft,
        name: `Common-JWT ${task.id}`,
      });
      expect(result.id).toBeDefined();
      testData.trackProfileForCleanup(result.id);
    },
  ),
});
