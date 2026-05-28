import { ProposalStatus } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import { describeDecisionGating } from '../../../test/helpers/decisionGating';
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

describe.concurrent('createProposal', () => {
  it('creates a draft proposal for an authenticated user', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.createProposal({
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Authenticated baseline' },
    });

    expect(result.status).toBe(ProposalStatus.DRAFT);
    if (result.profileId) {
      testData.trackProfileForCleanup(result.profileId);
    }
  });
});

// Public-mode gating matrix: createProposal sits on `authenticatedProcedure`,
// which rejects no-JWT callers at the middleware boundary regardless of
// instance visibility. Anon-JWT is admitted via the synth `Anonymous` role
// (grants SUBMIT_PROPOSALS) on public instances and rejected on non-public
// ones. Common-JWT (allow-listed org admin) is always allowed.
describeDecisionGating('createProposal', {
  noJwtPublic: async ({ task, onTestFinished, callers }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }
    await testData.setInstancePublic(instance.instance.id);

    const caller = await callers.noJwt();

    // `authenticatedProcedure` rejects no-JWT at the middleware boundary
    // before the router ever runs — public-mode toggle is irrelevant here.
    await expect(
      caller.decision.createProposal({
        processInstanceId: instance.instance.id,
        proposalData: { title: 'Should reject no-JWT create' },
      }),
    ).rejects.toMatchObject({
      cause: { name: 'UnauthorizedError' },
    });
  },

  anonJwtPublic: async ({ task, onTestFinished, callers }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }
    await testData.setInstancePublic(instance.instance.id);

    const caller = await callers.anonJwt();

    const result = await caller.decision.createProposal({
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Created by anon owner' },
    });

    expect(result.status).toBe(ProposalStatus.DRAFT);
    if (result.profileId) {
      testData.trackProfileForCleanup(result.profileId);
    }
  },

  commonJwtPublic: async ({ task, onTestFinished, callers }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }
    await testData.setInstancePublic(instance.instance.id);

    const caller = await callers.commonJwt(setup.userEmail);

    const result = await caller.decision.createProposal({
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Created by common admin on public instance' },
    });

    expect(result.status).toBe(ProposalStatus.DRAFT);
    if (result.profileId) {
      testData.trackProfileForCleanup(result.profileId);
    }
  },

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
    // Non-public by default — closed-network gate.

    const caller = await callers.noJwt();

    await expect(
      caller.decision.createProposal({
        processInstanceId: instance.instance.id,
        proposalData: { title: 'Should reject no-JWT create' },
      }),
    ).rejects.toMatchObject({
      cause: { name: 'UnauthorizedError' },
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
    // Non-public by default — closed-network gate.

    const caller = await callers.anonJwt();

    await expect(
      caller.decision.createProposal({
        processInstanceId: instance.instance.id,
        proposalData: { title: 'Non-public; anon should bounce' },
      }),
    ).rejects.toMatchObject({
      cause: { name: 'UnauthorizedError' },
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
    // Non-public — closed-network gate. Common-JWT (org admin) still
    // allowed via org-level access.

    const caller = await callers.commonJwt(setup.userEmail);

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
