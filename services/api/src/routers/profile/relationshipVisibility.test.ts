import { db } from '@op/db/client';
import { ProposalStatus, proposals } from '@op/db/schema';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { appRouter } from '..';
import { TestDecisionsDataManager } from '../../test/helpers/TestDecisionsDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../test/supabase-utils';
import { createCallerFactory } from '../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

/**
 * Guards the visibility gate added when like/follow moved off the closed-network
 * tier: a confirmed member may like a submitted proposal they can see, but must
 * not like another member's DRAFT (which the network tier used to shield).
 */
describe.concurrent('profile.addRelationship proposal visibility', () => {
  it('lets a member like a submitted proposal they can view', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instance;

    const [author, liker] = await Promise.all([
      testData.createMemberUser({
        organization: setup.organization,
        instanceProfileIds: [instance.profileId],
      }),
      testData.createMemberUser({
        organization: setup.organization,
        instanceProfileIds: [instance.profileId],
      }),
    ]);

    const proposal = await testData.createProposal({
      userEmail: author.email,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Visible proposal' },
    });
    await db
      .update(proposals)
      .set({ status: ProposalStatus.SUBMITTED })
      .where(eq(proposals.id, proposal.id));

    const likerCaller = await createAuthenticatedCaller(liker.email);
    await expect(
      likerCaller.profile.addRelationship({
        targetProfileId: proposal.profileId,
        relationshipType: 'likes',
      }),
    ).resolves.not.toThrow();
  });

  it("does not let a member like another member's draft proposal", async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instance;

    const [author, liker] = await Promise.all([
      testData.createMemberUser({
        organization: setup.organization,
        instanceProfileIds: [instance.profileId],
      }),
      testData.createMemberUser({
        organization: setup.organization,
        instanceProfileIds: [instance.profileId],
      }),
    ]);

    // Left as DRAFT — visible only to its author, not other instance members.
    const draft = await testData.createProposal({
      userEmail: author.email,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Draft proposal' },
    });

    const likerCaller = await createAuthenticatedCaller(liker.email);
    await expect(
      likerCaller.profile.addRelationship({
        targetProfileId: draft.profileId,
        relationshipType: 'likes',
      }),
    ).rejects.toThrow();
  });
});
