import { db } from '@op/db/client';
import {
  ProfileRelationshipType,
  ProposalStatus,
  profileRelationships,
  proposals,
} from '@op/db/schema';
import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import {
  accessTierGatingCell,
  describeAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../../test/helpers/gating';
import { createAuthenticatedCaller } from '../../../test/supabase-utils';

// Confirmed tier, not closed-network: accounts claimed from public decision
// processes are out-of-network but may engage with proposals. The service
// layer then gates on the parent decision (SUBMIT_PROPOSALS).
describeAccessTierGating('decision.addProposalRelationship', {
  noJwt: accessTierGatingCell('rejects no-JWT caller', async ({ callers }) => {
    const caller = await callers.noJwt();
    await expectFailsAccessTierGate(
      caller.decision.addProposalRelationship({
        targetProfileId: '00000000-0000-0000-0000-000000000000',
        relationshipType: 'following',
      }),
      'none',
    );
  }),

  anonJwt: accessTierGatingCell(
    'rejects anon-JWT caller',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expectFailsAccessTierGate(
        caller.decision.addProposalRelationship({
          targetProfileId: '00000000-0000-0000-0000-000000000000',
          relationshipType: 'following',
        }),
        'anon',
      );
    },
  ),

  userJwt: accessTierGatingCell(
    'admits out-of-network user-JWT past the tier gate',
    async ({ callers }) => {
      const caller = await callers.userJwt();
      await expectPassesAccessTierGate(
        caller.decision.addProposalRelationship({
          targetProfileId: '00000000-0000-0000-0000-000000000000',
          relationshipType: 'following',
        }),
      );
    },
  ),

  networkJwt: accessTierGatingCell(
    'admits network-JWT caller',
    async ({ callers }) => {
      const caller = await callers.networkJwt();
      await expectPassesAccessTierGate(
        caller.decision.addProposalRelationship({
          targetProfileId: '00000000-0000-0000-0000-000000000000',
          relationshipType: 'following',
        }),
      );
    },
  ),
});

/**
 * Proposal like/follow requires the same permission commenting does —
 * SUBMIT_PROPOSALS on the parent decision — so a confirmed account with no
 * standing on the decision can't like (or unlike) its proposals, and
 * non-proposal profiles are rejected outright (those go through the
 * closed-network `profile.addRelationship`). Covers both the add and remove
 * endpoints, which share `assertProposalEngagementAccess`.
 */
describe.concurrent('proposal relationship engagement access', () => {
  it('lets a caller with submit access like, follow, and unfollow a proposal in that decision', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const author = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [setup.instance.profileId],
    });
    const proposal = await testData.createProposal({
      userEmail: author.email,
      processInstanceId: setup.instance.instance.id,
      proposalData: { title: 'Likeable proposal' },
    });
    await db
      .update(proposals)
      .set({ status: ProposalStatus.SUBMITTED })
      .where(eq(proposals.id, proposal.id));

    const relationshipRows = (relationshipType: ProfileRelationshipType) =>
      db
        .select({ id: profileRelationships.id })
        .from(profileRelationships)
        .where(
          and(
            eq(profileRelationships.targetProfileId, proposal.profileId),
            eq(profileRelationships.relationshipType, relationshipType),
          ),
        );

    // setup.userEmail owns the decision (submit access).
    const ownerCaller = await createAuthenticatedCaller(setup.userEmail);
    await ownerCaller.decision.addProposalRelationship({
      targetProfileId: proposal.profileId,
      relationshipType: 'likes',
    });
    await ownerCaller.decision.addProposalRelationship({
      targetProfileId: proposal.profileId,
      relationshipType: 'following',
    });
    expect(await relationshipRows(ProfileRelationshipType.LIKES)).toHaveLength(
      1,
    );
    expect(
      await relationshipRows(ProfileRelationshipType.FOLLOWING),
    ).toHaveLength(1);

    // Unfollow removes only the following row; the like stays.
    await ownerCaller.decision.removeProposalRelationship({
      targetProfileId: proposal.profileId,
      relationshipType: 'following',
    });
    expect(
      await relationshipRows(ProfileRelationshipType.FOLLOWING),
    ).toHaveLength(0);
    expect(await relationshipRows(ProfileRelationshipType.LIKES)).toHaveLength(
      1,
    );
  });

  it('rejects a confirmed account with no standing on the decision', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: setup.instance.instance.id,
      proposalData: { title: 'Guarded proposal' },
    });
    await db
      .update(proposals)
      .set({ status: ProposalStatus.SUBMITTED })
      .where(eq(proposals.id, proposal.id));

    // A confirmed user who owns an unrelated decision has no grant on this one.
    const outsider = await new TestDecisionsDataManager(
      `${task.id}-outsider`,
      onTestFinished,
    ).createDecisionSetup({ instanceCount: 0, grantAccess: true });

    const outsiderCaller = await createAuthenticatedCaller(outsider.userEmail);
    await expect(
      outsiderCaller.decision.addProposalRelationship({
        targetProfileId: proposal.profileId,
        relationshipType: 'likes',
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });

    // Remove is gated by the same assert — no standing means no unlike either.
    await expect(
      outsiderCaller.decision.removeProposalRelationship({
        targetProfileId: proposal.profileId,
        relationshipType: 'likes',
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });

  it('rejects a non-proposal target profile', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 0,
      grantAccess: true,
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);
    await expect(
      caller.decision.addProposalRelationship({
        // The organization's profile is not a proposal profile.
        targetProfileId: setup.organization.profileId,
        relationshipType: 'likes',
      }),
    ).rejects.toMatchObject({ cause: { name: 'NotFoundError' } });
  });
});
