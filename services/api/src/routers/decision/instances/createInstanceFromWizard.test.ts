import {
  type DecisionInstanceData,
  MAX_PHASES_PER_DECISION,
  PROCESS_NAME_MAX_LENGTH,
  getSeededTemplateId,
  simpleVoting,
} from '@op/common';
import { TestDecisionsDataManager } from '@op/common/testing';
import { asc, db, eq, sql } from '@op/db/client';
import { ProcessStatus, decisionProcesses } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import {
  accessTierGatingCell,
  describeDecisionAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../../test/helpers/gating/decision';
import { createAuthenticatedCaller } from '../../../test/supabase-utils';

const grantDraft = {
  type: 'grant' as const,
  shape: 'single',
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

describe.concurrent('createInstanceFromWizard', () => {
  it('creates a draft whose phases are the wizard answers', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 0 });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.createInstanceFromWizard({
      ...grantDraft,
      name: `Wizard grant ${task.id}`,
    });
    testData.trackProfileForCleanup(result.id);

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
    expect(instanceData.templateId).toBe('wizard:grant:single');
    expect(instanceData.proposalTemplate).toEqual(
      simpleVoting.proposalTemplate,
    );
    expect(instance.currentStateId).toBe(instanceData.phases[0]?.phaseId);
  });

  it('creates a blank draft with no phases', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 0 });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.createInstanceFromWizard({
      name: `Wizard blank ${task.id}`,
      type: 'other',
      shape: 'blank',
      phases: [],
    });
    testData.trackProfileForCleanup(result.id);

    const { instance, instanceData } = await loadInstanceData(
      result.processInstance.id,
    );

    expect(instanceData.phases).toEqual([]);
    expect(instance.currentStateId).toBeNull();
  });

  it('is stewarded by the profile the creator is acting as', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 0 });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.createInstanceFromWizard({
      ...grantDraft,
      name: `Wizard steward ${task.id}`,
    });
    testData.trackProfileForCleanup(result.id);

    const { instance } = await loadInstanceData(result.processInstance.id);

    expect(instance.stewardProfileId).toBe(setup.organization.profileId);
  });

  it('rejects a phase kind the wizard does not offer', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 0 });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.decision.createInstanceFromWizard({
        ...grantDraft,
        name: `Wizard bad kind ${task.id}`,
        // @ts-expect-error -- the kind enum is the contract under test
        phases: [{ kind: 'deliberation', name: 'Talk it over' }],
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
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
      caller.decision.createInstanceFromWizard({ ...grantDraft, name }),
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
      caller.decision.createInstanceFromWizard({
        ...grantDraft,
        name: `Wizard phases ${task.id}`,
        phases,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('starts a blank draft on its first phase once phases are added', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 0 });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.createInstanceFromWizard({
      name: `Wizard blank to live ${task.id}`,
      type: 'other',
      shape: 'blank',
      phases: [],
    });
    testData.trackProfileForCleanup(result.id);
    const instanceId = result.processInstance.id;

    await caller.decision.updateDecisionInstance({
      instanceId,
      phases: [
        {
          phaseId: 'ideas',
          name: 'Ideas',
          rules: {
            proposals: { submit: true },
            advancement: { method: 'manual' },
          },
        },
        { phaseId: 'vote', name: 'Vote', rules: { voting: { submit: true } } },
      ],
      status: ProcessStatus.PUBLISHED,
    });

    const { instance } = await loadInstanceData(instanceId);

    expect(instance.status).toBe(ProcessStatus.PUBLISHED);
    expect(instance.currentStateId).toBe('ideas');
  });

  it('refuses to launch a process with no phases', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 0 });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.createInstanceFromWizard({
      name: `Wizard empty launch ${task.id}`,
      type: 'other',
      shape: 'blank',
      phases: [],
    });
    testData.trackProfileForCleanup(result.id);

    await expect(
      caller.decision.updateDecisionInstance({
        instanceId: result.processInstance.id,
        status: ProcessStatus.PUBLISHED,
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });

    const { instance } = await loadInstanceData(result.processInstance.id);
    expect(instance.status).toBe(ProcessStatus.DRAFT);
  });

  it('points at the seeded template even when a later copy exists', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 0 });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const [seeded] = await db
      .select({ id: decisionProcesses.id })
      .from(decisionProcesses)
      .where(
        sql`${decisionProcesses.processSchema}->>'id' = ${simpleVoting.id}`,
      )
      .orderBy(asc(decisionProcesses.createdAt))
      .limit(1);
    const [laterCopy] = await db
      .insert(decisionProcesses)
      .values({
        name: `Later copy ${task.id}`,
        processSchema: simpleVoting,
        createdByProfileId: setup.organization.profileId,
      })
      .returning({ id: decisionProcesses.id });
    onTestFinished(async () => {
      if (laterCopy) {
        await db
          .delete(decisionProcesses)
          .where(eq(decisionProcesses.id, laterCopy.id));
      }
    });

    const result = await caller.decision.createInstanceFromWizard({
      ...grantDraft,
      name: `Wizard seeded ${task.id}`,
    });
    testData.trackProfileForCleanup(result.id);

    const { instance } = await loadInstanceData(result.processInstance.id);

    expect(seeded).toBeDefined();
    expect(instance.processId).toBe(seeded?.id);
  });

  it('refuses to fall back when no template carries the schema id', async () => {
    await expect(getSeededTemplateId('no-such-schema')).rejects.toThrow(
      'No "no-such-schema" decision template has been seeded',
    );
  });
});

describeDecisionAccessTierGating('createInstanceFromWizard', {
  noJwtNonPublic: accessTierGatingCell(
    'rejects no-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      await testData.createDecisionSetup({ instanceCount: 0 });

      const caller = await callers.noJwt();

      await expectFailsAccessTierGate(
        caller.decision.createInstanceFromWizard({
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
        caller.decision.createInstanceFromWizard({
          ...grantDraft,
          name: `anon ${task.id}`,
        }),
        'anon',
      );
    },
  ),

  userJwtNonPublic: accessTierGatingCell(
    'admits user-JWT caller past the tier gate',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      await testData.createDecisionSetup({ instanceCount: 0 });

      const caller = await callers.userJwt();

      const created = caller.decision.createInstanceFromWizard({
        ...grantDraft,
        name: `user ${task.id}`,
      });
      await expectPassesAccessTierGate(created);
      testData.trackProfileForCleanup((await created).id);
    },
  ),

  networkJwtNonPublic: accessTierGatingCell(
    'admits network-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({ instanceCount: 0 });

      const caller = await callers.networkJwt(setup.userEmail);

      const result = await caller.decision.createInstanceFromWizard({
        ...grantDraft,
        name: `Common-JWT ${task.id}`,
      });
      expect(result.id).toBeDefined();
      testData.trackProfileForCleanup(result.id);
    },
  ),
});
