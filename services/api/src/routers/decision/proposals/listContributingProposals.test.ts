import { db } from '@op/db/client';
import { ProposalStatus, proposals } from '@op/db/schema';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import {
  accessTierGatingCell,
  describeDecisionAccessTierGating,
  expectPassesAccessTierGate,
} from '../../../test/helpers/gating/decision';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../../test/supabase-utils';
import { createCallerFactory } from '../../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

const UNKNOWN_PROPOSAL_ID = '00000000-0000-0000-0000-000000000000';

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

/**
 * Two proposals in one instance. Both carry a legacy `description`, so their
 * body preview resolves from the stored HTML without a collaboration-server
 * round trip.
 */
async function createMergeableProposals(testData: TestDecisionsDataManager) {
  const setup = await testData.createDecisionSetup({
    instanceCount: 1,
    grantAccess: true,
  });
  const instanceId = setup.instance.instance.id;

  const [source, target, caller] = await Promise.all([
    testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instanceId,
      proposalData: {
        title: 'Community Garden Expansion',
        description: 'Our community faces challenges with food security.',
      },
      status: ProposalStatus.SHORTLISTED,
    }),
    testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instanceId,
      proposalData: { title: 'Target Proposal', description: 'Survives' },
      status: ProposalStatus.SHORTLISTED,
    }),
    createAuthenticatedCaller(setup.userEmail),
  ]);

  return { setup, instanceId, source, target, caller };
}

describe.concurrent('listContributingProposals', () => {
  it('returns a card for each proposal merged into this one', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { source, target, caller } = await createMergeableProposals(testData);

    // Categories come from the stored snapshot, which `createProposal` seeds
    // with a title and description only.
    await db
      .update(proposals)
      .set({
        proposalData: {
          title: 'Community Garden Expansion',
          description: 'Our community faces challenges with food security.',
          category: ['Council District 5'],
        },
      })
      .where(eq(proposals.id, source.id));

    await caller.decision.mergeProposals({
      sourceProposalId: source.id,
      targetProposalId: target.id,
    });

    const result = await caller.decision.listContributingProposals({
      proposalId: target.id,
    });

    expect(result.proposals).toHaveLength(1);
    // The standard card row shape, so the app renders it through the same
    // mapping as every other proposal card.
    expect(result.proposals[0]).toMatchObject({
      id: source.id,
      // Routes to the proposal page, which is keyed on the profile, not the id.
      profileId: source.profileId,
      proposalData: {
        title: 'Community Garden Expansion',
        category: ['Council District 5'],
      },
      // The card's two-line body — resolved from the document, not the row.
      previewText: 'Our community faces challenges with food security.',
      // The anonymity flag the card reads to decide whether to link the
      // author's profile. Present means the `profileUsers` join was selected;
      // without it every author would silently read as non-anonymous.
      submittedBy: { name: expect.any(String), isAnonymous: false },
    });
  });

  it('leaves the categories empty when the proposal carries none', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { source, target, caller } = await createMergeableProposals(testData);

    await caller.decision.mergeProposals({
      sourceProposalId: source.id,
      targetProposalId: target.id,
    });

    const result = await caller.decision.listContributingProposals({
      proposalId: target.id,
    });

    // An empty array, not undefined — the card renders no meta separator.
    expect(result.proposals[0]?.proposalData.category).toEqual([]);
  });

  it('reads one direction only: the merged-away proposal has no contributors', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { source, target, caller } = await createMergeableProposals(testData);

    await caller.decision.mergeProposals({
      sourceProposalId: source.id,
      targetProposalId: target.id,
    });

    // Pinning the source asks "what merged into the thing that merged away" —
    // nothing. The header's "Merged into …" notice covers the other direction.
    const result = await caller.decision.listContributingProposals({
      proposalId: source.id,
    });

    expect(result.proposals).toEqual([]);
  });

  it('is empty for a proposal nothing was merged into', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { target, caller } = await createMergeableProposals(testData);

    const result = await caller.decision.listContributingProposals({
      proposalId: target.id,
    });

    expect(result.proposals).toEqual([]);
  });

  it('drops the card once unmerged', async ({ task, onTestFinished }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { source, target, caller } = await createMergeableProposals(testData);

    await caller.decision.mergeProposals({
      sourceProposalId: source.id,
      targetProposalId: target.id,
    });
    await caller.decision.unmergeProposal({ sourceProposalId: source.id });

    const result = await caller.decision.listContributingProposals({
      proposalId: target.id,
    });

    expect(result.proposals).toEqual([]);
  });

  it('is readable by a non-admin member of the decision', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, source, target, caller } =
      await createMergeableProposals(testData);

    await caller.decision.mergeProposals({
      sourceProposalId: source.id,
      targetProposalId: target.id,
    });

    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [setup.instance.profileId],
    });
    const memberCaller = await createAuthenticatedCaller(member.email);

    // Contributing ideas are meant for everyone who can read the decision —
    // the merged-away proposal is hidden from listings, not from this section.
    const result = await memberCaller.decision.listContributingProposals({
      proposalId: target.id,
    });

    expect(result.proposals.map((proposal) => proposal.id)).toEqual([
      source.id,
    ]);
  });
});

describeDecisionAccessTierGating('decision.listContributingProposals', {
  noJwtNonPublic: accessTierGatingCell(
    'admits no-JWT caller past the tier gate',
    async ({ callers }) => {
      const caller = await callers.noJwt();
      await expectPassesAccessTierGate(
        caller.decision.listContributingProposals({
          proposalId: UNKNOWN_PROPOSAL_ID,
        }),
      );
    },
  ),

  anonJwtNonPublic: accessTierGatingCell(
    'admits anon-JWT caller past the tier gate',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expectPassesAccessTierGate(
        caller.decision.listContributingProposals({
          proposalId: UNKNOWN_PROPOSAL_ID,
        }),
      );
    },
  ),

  userJwtNonPublic: accessTierGatingCell(
    'admits out-of-network user-JWT caller past the tier gate',
    async ({ callers }) => {
      const caller = await callers.userJwt();
      await expectPassesAccessTierGate(
        caller.decision.listContributingProposals({
          proposalId: UNKNOWN_PROPOSAL_ID,
        }),
      );
    },
  ),

  networkJwtNonPublic: accessTierGatingCell(
    'admits network-JWT caller past the tier gate',
    async ({ callers }) => {
      const caller = await callers.networkJwt();
      await expectPassesAccessTierGate(
        caller.decision.listContributingProposals({
          proposalId: UNKNOWN_PROPOSAL_ID,
        }),
      );
    },
  ),
});
