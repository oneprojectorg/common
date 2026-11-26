import {
  TestDecisionsDataManager,
  createAssignedSourceReviewer,
  createDevelopPhaseSetup,
  createDevelopProposalsMember,
} from '@op/common/testing';
import { users } from '@op/db/schema';
import { db, eq } from '@op/db/test';
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
  it('refuses a co-author of a developed draft whose current profile is the draft’s submitter profile', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, source } = await createDevelopPhaseSetup({
      testData,
    });
    const [developer, coauthor] = await Promise.all([
      createDevelopProposalsMember({ testData, setup }),
      createAssignedSourceReviewer({
        testData,
        setup,
        sourceProposalId: source.id,
      }),
    ]);
    const developerCaller = await createAuthenticatedCaller(developer.email);
    const draft = await developerCaller.decision.createDevelopedProposal({
      processInstanceId: instanceId,
      sourceProposalIds: [source.id],
      proposalData: { title: 'Developed' },
    });
    testData.trackProfileForCleanup(draft.profileId);
    const stored = await db.query.proposals.findFirst({
      where: { id: draft.id },
      columns: { submittedByProfileId: true },
    });
    if (!stored) {
      throw new Error('Expected the stored draft');
    }
    // An organization profile both members switched to matches the submitter arm.
    await db
      .update(users)
      .set({ currentProfileId: stored.submittedByProfileId })
      .where(eq(users.authUserId, coauthor.authUserId));
    const coauthorCaller = await createAuthenticatedCaller(coauthor.email);

    await expect(
      coauthorCaller.decision.deleteProposal({ proposalId: draft.id }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });
});
