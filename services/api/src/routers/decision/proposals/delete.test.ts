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

describeDecisionAccessTierGating('deleteProposal', {
  noJwtNonPublic: accessTierGatingCell(
    'rejects no-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instance;
      const proposal = await testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'no-JWT should not reach this' },
      });

      const caller = await callers.noJwt();

      await expectFailsAccessTierGate(
        caller.decision.deleteProposal({ proposalId: proposal.id }),
        'none',
      );
    },
  ),

  anonJwtNonPublic: accessTierGatingCell(
    'admits anon-JWT caller past the tier gate',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instance;
      const proposal = await testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'anon should bounce' },
      });

      const caller = await callers.anonJwt();

      await expectPassesAccessTierGate(
        caller.decision.deleteProposal({ proposalId: proposal.id }),
      );
    },
  ),

  userJwtNonPublic: accessTierGatingCell(
    'admits user-JWT caller past the tier gate',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instance;
      const proposal = await testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'anon should bounce' },
      });

      const caller = await callers.userJwt();

      await expectPassesAccessTierGate(
        caller.decision.deleteProposal({ proposalId: proposal.id }),
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
      const instance = setup.instance;
      const proposal = await testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'Common-JWT owner deletes' },
      });

      const caller = await callers.networkJwt(setup.userEmail);

      const result = await caller.decision.deleteProposal({
        proposalId: proposal.id,
      });

      expect(result.deletedId).toBe(proposal.id);
    },
  ),
});

describe.concurrent('deleteProposal', () => {
  it('lets a profile admin without Manage Process delete a proposal', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const profileAdmin = await testData.createProfileAdminUser({
      organization: setup.organization,
      instanceProfileId: setup.instance.profileId,
    });
    const [proposal, profileAdminCaller] = await Promise.all([
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: setup.instance.instance.id,
        proposalData: { title: 'Proposal' },
      }),
      createAuthenticatedCaller(profileAdmin.email),
    ]);

    const result = await profileAdminCaller.decision.deleteProposal({
      proposalId: proposal.id,
    });

    expect(result.deletedId).toBe(proposal.id);
    await expect(
      db.query.proposals.findFirst({ where: { id: proposal.id } }),
    ).resolves.toBeUndefined();
  });
});
