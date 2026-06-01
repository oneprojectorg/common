import { ProposalStatus } from '@op/db/schema';
import { expect } from 'vitest';

import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import { describeDecisionGating } from '../../../test/helpers/gating/decision';

// Network gating matrix: createProposal sits on `commonAuthedProcedure`,
// which rejects no-JWT and anon-JWT callers at the auth middleware. A
// common-JWT allow-listed user is admitted, and the owner can create.
// Public-instance cells will be added when the public-mode toggle ships.
describeDecisionGating('createProposal', {
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

    await expect(
      caller.decision.createProposal({
        processInstanceId: instance.instance.id,
        proposalData: { title: 'Should reject no-JWT create' },
      }),
    ).rejects.toMatchObject({
      cause: { name: 'AuthenticationError' },
    });
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

    await expect(
      caller.decision.createProposal({
        processInstanceId: instance.instance.id,
        proposalData: { title: 'Non-public; anon should bounce' },
      }),
    ).rejects.toMatchObject({
      cause: { name: 'AuthenticationError' },
    });
  },

  commonJwtNonPublic: async ({ task, onTestFinished, callers }) => {
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
