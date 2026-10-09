import { type DecisionInstanceData, simpleVoting } from '@op/common';
import { TestDecisionsDataManager } from '@op/common/testing';
import { db } from '@op/db/client';
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
    ).rejects.toThrow();
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
