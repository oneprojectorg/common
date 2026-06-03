import { ProposalStatus } from '@op/db/schema';
import { expect } from 'vitest';

import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import {
  describeDecisionAccessTierGating,
  expectFailsAccessTierGate,
} from '../../../test/helpers/gating/decision';

describeDecisionAccessTierGating('createProposal', {
  noJwtNonPublic: async ({ task, onTestFinished, callers }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    const caller = await callers.noJwt();

    await expectFailsAccessTierGate(
      caller.decision.createProposal({
        processInstanceId: instance.instance.id,
        proposalData: { title: 'Should reject no-JWT create' },
      }),
      'none',
    );
  },

  anonJwtNonPublic: async ({ task, onTestFinished, callers }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    const caller = await callers.anonJwt();

    await expectFailsAccessTierGate(
      caller.decision.createProposal({
        processInstanceId: instance.instance.id,
        proposalData: { title: 'Non-public; anon should bounce' },
      }),
      'anon',
    );
  },

  userJwtNonPublic: async ({ task, onTestFinished, callers }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    const caller = await callers.userJwt();

    await expectFailsAccessTierGate(
      caller.decision.createProposal({
        processInstanceId: instance.instance.id,
        proposalData: { title: 'Non-public; anon should bounce' },
      }),
      'user',
    );
  },

  networkJwtNonPublic: async ({ task, onTestFinished, callers }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    const caller = await callers.networkJwt(setup.userEmail);

    const result = await caller.decision.createProposal({
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Created by common admin on non-public instance' },
    });

    expect(result.status).toBe(ProposalStatus.DRAFT);
    if (result.profileId) {
      testData.trackProfileForCleanup(result.profileId);
    }
  },
});
