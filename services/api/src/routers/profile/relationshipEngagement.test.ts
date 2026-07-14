import { db } from '@op/db/client';
import { ProposalStatus, proposals } from '@op/db/schema';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { TestDecisionsDataManager } from '../../test/helpers/TestDecisionsDataManager';
import { createAuthenticatedCaller } from '../../test/supabase-utils';

/**
 * Like/follow moved off the closed-network tier, so the service layer is now
 * the only guard. It gates a proposal like/follow the same way commenting is
 * gated — SUBMIT_PROPOSALS on the parent decision — so a confirmed account
 * with no standing on the decision can't like its proposals.
 */
describe.concurrent('profile.addRelationship engagement access', () => {
  it('lets a caller with submit access like a proposal in that decision', async ({
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

    // setup.userEmail owns the decision (submit access).
    const ownerCaller = await createAuthenticatedCaller(setup.userEmail);
    await expect(
      ownerCaller.profile.addRelationship({
        targetProfileId: proposal.profileId,
        relationshipType: 'likes',
      }),
    ).resolves.not.toThrow();
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
      outsiderCaller.profile.addRelationship({
        targetProfileId: proposal.profileId,
        relationshipType: 'likes',
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });
});
