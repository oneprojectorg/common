import { db } from '@op/db/client';
import { ProposalStatus, Visibility, proposals } from '@op/db/schema';
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
 * Two proposals in one instance, both carrying a legacy `description` so the
 * preview resolves without a collaboration-server round trip.
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

/**
 * A member-authored proposal, hidden by the admin and then merged into an
 * admin-owned target. The author is deliberately *not* the admin: sharing them
 * would let the proposal-profile member exception admit the admin, and the
 * admin exception would never be exercised.
 */
async function createHiddenContributingProposal(
  testData: TestDecisionsDataManager,
) {
  const setup = await testData.createDecisionSetup({
    instanceCount: 1,
    grantAccess: true,
  });
  const instanceId = setup.instance.instance.id;

  const [target, adminCaller, author] = await Promise.all([
    testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instanceId,
      proposalData: { title: 'Target Proposal', description: 'Survives' },
      status: ProposalStatus.SHORTLISTED,
    }),
    createAuthenticatedCaller(setup.userEmail),
    testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [setup.instance.profileId],
    }),
  ]);

  const source = await testData.createProposal({
    userEmail: author.email,
    processInstanceId: instanceId,
    proposalData: {
      title: 'Hidden Contribution',
      description: 'Hidden, then merged',
    },
    status: ProposalStatus.SHORTLISTED,
  });

  await adminCaller.decision.updateProposal({
    proposalId: source.id,
    data: { visibility: Visibility.HIDDEN },
  });
  await adminCaller.decision.mergeProposals({
    sourceProposalId: source.id,
    targetProposalId: target.id,
  });

  return { setup, source, target, adminCaller, author };
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
    expect(result.proposals[0]).toMatchObject({
      id: source.id,
      // The proposal route is keyed on the profile, not the id.
      profileId: source.profileId,
      proposalData: {
        title: 'Community Garden Expansion',
        category: ['Council District 5'],
      },
      previewText: 'Our community faces challenges with food security.',
      // `isAnonymous` present means the `profileUsers` join was selected;
      // without it every author reads as non-anonymous.
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

    // The other direction is the header's "Merged into …" notice.
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

    // A merged-away proposal is hidden from listings, not from this section.
    const result = await memberCaller.decision.listContributingProposals({
      proposalId: target.id,
    });

    expect(result.proposals.map((proposal) => proposal.id)).toEqual([
      source.id,
    ]);
  });
});

describe.concurrent('listContributingProposals: hidden proposals', () => {
  it('shows a hidden contributing proposal to a decision admin', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { source, target, adminCaller } =
      await createHiddenContributingProposal(testData);

    // Same rule `listProposals` applies: hidden never means hidden from the
    // admins who can unhide it.
    const result = await adminCaller.decision.listContributingProposals({
      proposalId: target.id,
    });

    expect(result.proposals.map((proposal) => proposal.id)).toEqual([
      source.id,
    ]);
  });

  it('shows a hidden contributing proposal to its own author', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { source, target, author } =
      await createHiddenContributingProposal(testData);

    const authorCaller = await createAuthenticatedCaller(author.email);

    const result = await authorCaller.decision.listContributingProposals({
      proposalId: target.id,
    });

    expect(result.proposals.map((proposal) => proposal.id)).toEqual([
      source.id,
    ]);
  });

  it('hides it from a member who is neither an admin nor its author', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, target } = await createHiddenContributingProposal(testData);

    const bystander = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [setup.instance.profileId],
    });
    const bystanderCaller = await createAuthenticatedCaller(bystander.email);

    const result = await bystanderCaller.decision.listContributingProposals({
      proposalId: target.id,
    });

    expect(result.proposals).toEqual([]);
  });

  it('lists contributing ideas on a hidden proposal for an admin', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { source, target, adminCaller } =
      await createHiddenContributingProposal(testData);

    // The *pinned* end is what's hidden this time. An admin can open the page,
    // so the section on it must load rather than 404.
    await adminCaller.decision.updateProposal({
      proposalId: target.id,
      data: { visibility: Visibility.HIDDEN },
    });

    const result = await adminCaller.decision.listContributingProposals({
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
