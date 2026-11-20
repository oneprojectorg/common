import {
  TestDecisionsDataManager,
  createAssignedSourceReviewer,
  createCategoryReviewerWithTerm,
  createDevelopPhaseSetup,
  createDevelopProposalsMember,
} from '@op/common/testing';
import { describe, expect, it } from 'vitest';

import {
  accessTierGatingCell,
  describeAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../../test/helpers/gating';
import { createAuthenticatedCaller } from '../../../test/supabase-utils';

const UNKNOWN_PROPOSAL_ID = '00000000-0000-0000-0000-000000000000';

describeAccessTierGating('decision.getDevelopEntryLock', {
  noJwt: accessTierGatingCell(
    'rejects a no-JWT caller',
    async ({ callers }) => {
      const caller = await callers.noJwt();
      await expectFailsAccessTierGate(
        caller.decision.getDevelopEntryLock({
          proposalId: UNKNOWN_PROPOSAL_ID,
        }),
        'none',
      );
    },
  ),

  anonJwt: accessTierGatingCell(
    'rejects an anon-JWT caller',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expectFailsAccessTierGate(
        caller.decision.getDevelopEntryLock({
          proposalId: UNKNOWN_PROPOSAL_ID,
        }),
        'anon',
      );
    },
  ),

  userJwt: accessTierGatingCell(
    'rejects an out-of-network user-JWT caller',
    async ({ callers }) => {
      const caller = await callers.userJwt();
      await expectFailsAccessTierGate(
        caller.decision.getDevelopEntryLock({
          proposalId: UNKNOWN_PROPOSAL_ID,
        }),
        'user',
      );
    },
  ),

  networkJwt: accessTierGatingCell(
    'admits a network-JWT caller past the tier gate',
    async ({ callers }) => {
      const caller = await callers.networkJwt();
      await expectPassesAccessTierGate(
        caller.decision.getDevelopEntryLock({
          proposalId: UNKNOWN_PROPOSAL_ID,
        }),
      );
    },
  ),
});

describe.concurrent('getDevelopEntryLock', () => {
  it('gives a co-author the lock of the entry’s owner: none, then confirmed once the owner confirms', async ({
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
    await createCategoryReviewerWithTerm({
      processInstanceId: instanceId,
      reviewerProfileId: developer.profileId,
      phaseId: 'final',
      onTestFinished,
    });
    const [developerCaller, coauthorCaller] = await Promise.all([
      createAuthenticatedCaller(developer.email),
      createAuthenticatedCaller(coauthor.email),
    ]);
    const draft = await developerCaller.decision.createDevelopedProposal({
      processInstanceId: instanceId,
      sourceProposalIds: [source.id],
      proposalData: { title: 'Developed' },
    });
    testData.trackProfileForCleanup(draft.profileId);

    const beforeConfirm = await coauthorCaller.decision.getDevelopEntryLock({
      proposalId: draft.id,
    });
    await developerCaller.decision.confirmCategoryDevelopment({
      processInstanceId: instanceId,
    });
    const afterConfirm = await coauthorCaller.decision.getDevelopEntryLock({
      proposalId: draft.id,
    });

    expect(beforeConfirm).toEqual({ lock: null });
    expect(afterConfirm).toEqual({ lock: 'confirmed' });
  });

  it('refuses a reviewer who is not a member of the entry', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, source, otherSources } =
      await createDevelopPhaseSetup({ testData, sourceCount: 2 });
    const otherSource = otherSources[0];
    if (!otherSource) {
      throw new Error('Expected a second source');
    }
    const [developer, otherSourceReviewer] = await Promise.all([
      createDevelopProposalsMember({ testData, setup }),
      createAssignedSourceReviewer({
        testData,
        setup,
        sourceProposalId: otherSource.id,
      }),
    ]);
    const [developerCaller, otherSourceCaller] = await Promise.all([
      createAuthenticatedCaller(developer.email),
      createAuthenticatedCaller(otherSourceReviewer.email),
    ]);
    const draft = await developerCaller.decision.createDevelopedProposal({
      processInstanceId: instanceId,
      sourceProposalIds: [source.id],
      proposalData: { title: 'Developed' },
    });
    testData.trackProfileForCleanup(draft.profileId);

    await expect(
      otherSourceCaller.decision.getDevelopEntryLock({ proposalId: draft.id }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });
});
