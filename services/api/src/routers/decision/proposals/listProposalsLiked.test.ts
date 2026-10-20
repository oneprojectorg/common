import { TestDecisionsDataManager } from '@op/common/testing';
import { ProposalStatus } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { createAuthenticatedCaller } from '../../../test/supabase-utils';

describe.concurrent('listProposals: likedByCurrentUser (liked filter)', () => {
  it("returns only the proposals the caller liked, not another member's likes", async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instance;

    const [liker, otherLiker] = await Promise.all([
      testData.createMemberUser({
        organization: setup.organization,
        instanceProfileIds: [instance.profileId],
      }),
      testData.createMemberUser({
        organization: setup.organization,
        instanceProfileIds: [instance.profileId],
      }),
    ]);

    const createSubmitted = (title: string) =>
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: `${title} ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      });

    const [likedA, likedB, likedByOther, unliked] = await Promise.all([
      createSubmitted('Liked A'),
      createSubmitted('Liked B'),
      createSubmitted('Liked by other'),
      createSubmitted('Unliked'),
    ]);

    const [likerCaller, otherLikerCaller] = await Promise.all([
      createAuthenticatedCaller(liker.email),
      createAuthenticatedCaller(otherLiker.email),
    ]);

    const like = (
      caller: typeof likerCaller,
      proposal: { profileId: string },
    ) =>
      caller.decision.addProposalRelationship({
        targetProfileId: proposal.profileId,
        relationshipType: 'likes',
      });

    await Promise.all([
      like(likerCaller, likedA),
      like(likerCaller, likedB),
      like(otherLikerCaller, likedByOther),
    ]);

    const result = await likerCaller.decision.listProposals({
      processInstanceId: instance.instance.id,
      likedByCurrentUser: true,
    });

    const ids = result.items.map((p) => p.id);
    expect(ids.sort()).toEqual([likedA.id, likedB.id].sort());
    expect(ids).not.toContain(likedByOther.id);
    expect(ids).not.toContain(unliked.id);
    expect(result.total).toBe(2);
  });

  it('narrows alongside the other filters', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instance;

    const liker = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });

    const [bikeLane, communityGarden] = await Promise.all(
      ['Bike lane', 'Community garden'].map((title) =>
        testData.createProposal({
          userEmail: setup.userEmail,
          processInstanceId: instance.instance.id,
          proposalData: { title: `${title} ${task.id}` },
          status: ProposalStatus.SUBMITTED,
        }),
      ),
    );

    if (!bikeLane || !communityGarden) {
      throw new Error('Failed to seed proposals');
    }

    const likerCaller = await createAuthenticatedCaller(liker.email);

    await Promise.all(
      [bikeLane, communityGarden].map((proposal) =>
        likerCaller.decision.addProposalRelationship({
          targetProfileId: proposal.profileId,
          relationshipType: 'likes',
        }),
      ),
    );

    const [searched, allProposals] = await Promise.all([
      likerCaller.decision.listProposals({
        processInstanceId: instance.instance.id,
        likedByCurrentUser: true,
        search: 'garden',
      }),
      likerCaller.decision.listProposals({
        processInstanceId: instance.instance.id,
      }),
    ]);

    expect(searched.items.map((p) => p.id)).toEqual([communityGarden.id]);
    // Without the filter, the list is unchanged.
    expect(allProposals.items.map((p) => p.id).sort()).toEqual(
      [bikeLane.id, communityGarden.id].sort(),
    );
  });
});
