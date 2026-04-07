import { mockCollab } from '@op/collab/testing';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
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

describe.concurrent('listProposalVersions', () => {
  it('should return an empty version list when no saved versions exist yet', async ({
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

    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Current proposal' },
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);
    const result = await caller.decision.listProposalVersions({
      proposalId: proposal.id,
    });

    expect(result).toEqual({
      versions: [],
    });
  });

  it('should list proposal versions newest first', async ({
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

    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Current proposal' },
    });

    mockCollab.setVersions(`proposal-${proposal.id}`, [
      { version: 1, createdAt: '2026-03-18T08:50:47.853Z', name: 'Version 1' },
      { version: 3, createdAt: '2026-03-18T08:52:28.281Z', name: 'Version 3' },
      { version: 2, createdAt: '2026-03-18T08:50:54.820Z', name: 'Version 2' },
    ]);

    const caller = await createAuthenticatedCaller(setup.userEmail);
    const result = await caller.decision.listProposalVersions({
      proposalId: proposal.id,
    });

    expect(result.versions.map((version) => version.version)).toEqual([
      3, 2, 1,
    ]);
  });

  it('should throw NotFoundError for non-existent proposal', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 0,
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.decision.listProposalVersions({
        proposalId: '00000000-0000-0000-0000-000000000000',
      }),
    ).rejects.toMatchObject({ cause: { name: 'NotFoundError' } });
  });

  it('should reject version history access for non-editors', async ({
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

    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Current proposal' },
    });

    const memberUser = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [],
    });
    const caller = await createAuthenticatedCaller(memberUser.email);

    await expect(
      caller.decision.listProposalVersions({
        proposalId: proposal.id,
      }),
    ).rejects.toMatchObject({
      cause: { name: 'AccessControlException' },
    });
  });
});
