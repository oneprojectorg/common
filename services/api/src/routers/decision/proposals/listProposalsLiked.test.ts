import { TestDecisionsDataManager } from '@op/common/testing';
import { ProposalStatus } from '@op/db/schema';
import { TRPCError } from '@trpc/server';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import {
  createAuthenticatedCaller,
  createTestContextWithSession,
} from '../../../test/supabase-utils';
import { createCallerFactory } from '../../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

describe.concurrent('listProposals: likedByProfileId (liked filter)', () => {
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

    const [likedA, likedB, likedByOther] = await Promise.all([
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
      likedByProfileId: liker.profileId,
    });

    // Neither another member's like nor an unliked proposal comes through.
    expect(result.items.map((p) => p.id).sort()).toEqual(
      [likedA.id, likedB.id].sort(),
    );
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

    const createSubmitted = (title: string, userEmail = setup.userEmail) =>
      testData.createProposal({
        userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: `${title} ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      });

    const [bikeLane, communityGarden, ownGarden] = await Promise.all([
      createSubmitted('Bike lane'),
      createSubmitted('Community garden'),
      createSubmitted('Rooftop garden', liker.email),
    ]);

    const likerCaller = await createAuthenticatedCaller(liker.email);

    await Promise.all(
      [bikeLane, communityGarden, ownGarden].map((proposal) =>
        likerCaller.decision.addProposalRelationship({
          targetProfileId: proposal.profileId,
          relationshipType: 'likes',
        }),
      ),
    );

    const [searched, ownLiked, allProposals] = await Promise.all([
      likerCaller.decision.listProposals({
        processInstanceId: instance.instance.id,
        likedByProfileId: liker.profileId,
        search: 'community',
      }),
      likerCaller.decision.listProposals({
        processInstanceId: instance.instance.id,
        likedByProfileId: liker.profileId,
        submittedByProfileId: liker.profileId,
      }),
      likerCaller.decision.listProposals({
        processInstanceId: instance.instance.id,
      }),
    ]);

    expect(searched.items.map((p) => p.id)).toEqual([communityGarden.id]);
    expect(ownLiked.items.map((p) => p.id)).toEqual([ownGarden.id]);
    // Without the filter, the list is unchanged.
    expect(allProposals.items.map((p) => p.id).sort()).toEqual(
      [bikeLane.id, communityGarden.id, ownGarden.id].sort(),
    );
  });

  it("rejects another member or a signed-out visitor asking for someone's likes", async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instance;

    await testData.makeDecisionPublic(instance.profileId);

    const [liker, snoop] = await Promise.all([
      testData.createMemberUser({
        organization: setup.organization,
        instanceProfileIds: [instance.profileId],
      }),
      testData.createMemberUser({
        organization: setup.organization,
        instanceProfileIds: [instance.profileId],
      }),
    ]);

    const [snoopCaller, publicCaller] = await Promise.all([
      createAuthenticatedCaller(snoop.email),
      createTestContextWithSession(null).then(createCaller),
    ]);

    await Promise.all(
      [snoopCaller, publicCaller].map((caller) =>
        expect(
          caller.decision.listProposals({
            processInstanceId: instance.instance.id,
            likedByProfileId: liker.profileId,
          }),
        ).rejects.toThrowError(TRPCError),
      ),
    );
  });
});
