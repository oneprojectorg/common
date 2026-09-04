import { createPostOnProfile } from '@op/common';
import { db } from '@op/db/client';
import {
  ModerationFlagStatus,
  ModerationItemType,
  ModerationSource,
  ProposalStatus,
  Visibility,
  moderationFlags,
  postsToProfiles,
  proposals,
} from '@op/db/schema';
import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { appRouter } from '..';
import { TestDecisionsDataManager } from '../../test/helpers/TestDecisionsDataManager';
import {
  accessTierGatingCell,
  describeAccessTierGating,
  expectPassesAccessTierGate,
} from '../../test/helpers/gating';
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

/** Pins a comment's feed position; `postsToProfiles.createdAt` is the sort key. */
async function setCommentTime(postId: string, profileId: string, at: string) {
  await db
    .update(postsToProfiles)
    .set({ createdAt: at })
    .where(
      and(
        eq(postsToProfiles.postId, postId),
        eq(postsToProfiles.profileId, profileId),
      ),
    );
}

/**
 * One proposal merged into another, each carrying comments stamped so the
 * expected feed order is source-late, target, source-early.
 */
async function createMergedProposalsWithComments(
  testData: TestDecisionsDataManager,
) {
  const setup = await testData.createDecisionSetup({
    instanceCount: 1,
    grantAccess: true,
  });
  const instanceId = setup.instance.instance.id;

  const [source, target, caller] = await Promise.all([
    testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instanceId,
      proposalData: { title: 'Community Garden Expansion' },
      status: ProposalStatus.SHORTLISTED,
    }),
    testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instanceId,
      proposalData: { title: 'Target Proposal' },
      status: ProposalStatus.SHORTLISTED,
    }),
    createAuthenticatedCaller(setup.userEmail),
  ]);

  const [sourceEarly, targetComment, sourceLate] = await Promise.all([
    createPostOnProfile({
      content: 'Written on the idea that was merged in, first',
      targetProfileId: source.profileId,
      authUserId: setup.user.id,
    }),
    createPostOnProfile({
      content: 'Written on the surviving proposal',
      targetProfileId: target.profileId,
      authUserId: setup.user.id,
    }),
    createPostOnProfile({
      content: 'Written on the idea that was merged in, last',
      targetProfileId: source.profileId,
      authUserId: setup.user.id,
    }),
  ]);

  await setCommentTime(
    sourceEarly.id,
    source.profileId,
    '2026-01-01T10:00:00.000Z',
  );
  await setCommentTime(
    targetComment.id,
    target.profileId,
    '2026-01-01T11:00:00.000Z',
  );
  await setCommentTime(
    sourceLate.id,
    source.profileId,
    '2026-01-01T12:00:00.000Z',
  );

  await caller.decision.mergeProposals({
    sourceProposalId: source.id,
    targetProposalId: target.id,
  });

  return {
    setup,
    source,
    target,
    caller,
    sourceEarly,
    targetComment,
    sourceLate,
  };
}

describe.concurrent('posts.listProposalComments', () => {
  it('interleaves merged-in comments by submission time and names where each was written', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { caller, target, source, sourceEarly, targetComment, sourceLate } =
      await createMergedProposalsWithComments(testData);

    const result = await caller.posts.listProposalComments({
      profileId: target.profileId,
    });

    expect(result.items.map((item) => item.post.id)).toEqual([
      sourceLate.id,
      targetComment.id,
      sourceEarly.id,
    ]);
    expect(result.items.map((item) => item.originProposal)).toEqual([
      { profileId: source.profileId, name: 'Community Garden Expansion' },
      null,
      { profileId: source.profileId, name: 'Community Garden Expansion' },
    ]);
  });

  it('pages one cursor across both proposals without skipping or repeating a comment', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { caller, target, sourceEarly, targetComment, sourceLate } =
      await createMergedProposalsWithComments(testData);

    const firstPage = await caller.posts.listProposalComments({
      profileId: target.profileId,
      limit: 2,
    });

    expect(firstPage.items.map((item) => item.post.id)).toEqual([
      sourceLate.id,
      targetComment.id,
    ]);
    expect(firstPage.next).toBeTruthy();

    const secondPage = await caller.posts.listProposalComments({
      profileId: target.profileId,
      limit: 2,
      cursor: firstPage.next,
    });

    expect(secondPage.items.map((item) => item.post.id)).toEqual([
      sourceEarly.id,
    ]);
    expect(secondPage.next).toBeNull();
  });

  it('carries a hidden merged proposal’s comments to an admin but not to other members', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const {
      setup,
      caller,
      target,
      source,
      targetComment,
      sourceEarly,
      sourceLate,
    } = await createMergedProposalsWithComments(testData);

    await db
      .update(proposals)
      .set({ visibility: Visibility.HIDDEN })
      .where(eq(proposals.id, source.id));

    // Same gate `listContributingProposals` applies to the far end of an edge:
    // a hidden merged proposal stays listed for whoever can still open it, so
    // the comments it carries over have to follow the card.
    const adminResult = await caller.posts.listProposalComments({
      profileId: target.profileId,
    });
    expect(adminResult.items.map((item) => item.post.id)).toEqual([
      sourceLate.id,
      targetComment.id,
      sourceEarly.id,
    ]);

    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [setup.instance.profileId],
    });
    const memberCaller = await createAuthenticatedCaller(member.email);

    const memberResult = await memberCaller.posts.listProposalComments({
      profileId: target.profileId,
    });
    expect(memberResult.items.map((item) => item.post.id)).toEqual([
      targetComment.id,
    ]);
  });

  it('stops carrying a proposal’s comments once it is unmerged', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { caller, target, source, targetComment } =
      await createMergedProposalsWithComments(testData);

    await caller.decision.unmergeProposal({ sourceProposalId: source.id });

    const result = await caller.posts.listProposalComments({
      profileId: target.profileId,
    });

    expect(result.items.map((item) => item.post.id)).toEqual([
      targetComment.id,
    ]);
  });

  it('hides a flagged carried-over comment from the proposal owner but not from a process admin', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instanceId = setup.instance.instance.id;
    const instanceProfileId = setup.instance.profileId;

    // The proposals' author is an ordinary participant: the seeded Member role
    // carries `decisions: SUBMIT_PROPOSALS` but only `profile: READ` on the
    // decision, while `createProposal` makes them Admin on the two proposal
    // profiles they own. Exactly the principal whose standing must not count.
    const [owner, commenter] = await Promise.all([
      testData.createMemberUser({
        organization: setup.organization,
        instanceProfileIds: [instanceProfileId],
      }),
      testData.createMemberUser({
        organization: setup.organization,
        instanceProfileIds: [instanceProfileId],
      }),
    ]);

    const [source, target, adminCaller, ownerCaller, commenterCaller] =
      await Promise.all([
        testData.createProposal({
          userEmail: owner.email,
          processInstanceId: instanceId,
          proposalData: { title: 'Merged-in idea' },
          status: ProposalStatus.SHORTLISTED,
        }),
        testData.createProposal({
          userEmail: owner.email,
          processInstanceId: instanceId,
          proposalData: { title: 'Surviving proposal' },
          status: ProposalStatus.SHORTLISTED,
        }),
        createAuthenticatedCaller(setup.userEmail),
        createAuthenticatedCaller(owner.email),
        createAuthenticatedCaller(commenter.email),
      ]);

    const [clean, flagged] = await Promise.all([
      createPostOnProfile({
        content: 'Clean comment on the merged-in idea',
        targetProfileId: source.profileId,
        authUserId: commenter.authUserId,
      }),
      createPostOnProfile({
        content: 'Flagged comment on the merged-in idea',
        targetProfileId: source.profileId,
        authUserId: commenter.authUserId,
      }),
    ]);

    await setCommentTime(
      flagged.id,
      source.profileId,
      '2026-01-01T12:00:00.000Z',
    );
    await setCommentTime(
      clean.id,
      source.profileId,
      '2026-01-01T10:00:00.000Z',
    );

    await db.insert(moderationFlags).values({
      itemType: ModerationItemType.POST,
      itemId: flagged.id,
      status: ModerationFlagStatus.FLAGGED,
      source: ModerationSource.AUTOMATED,
      reason: 'listProposalComments test',
    });
    onTestFinished(async () => {
      await db
        .delete(moderationFlags)
        .where(eq(moderationFlags.itemId, flagged.id));
    });

    await adminCaller.decision.mergeProposals({
      sourceProposalId: source.id,
      targetProposalId: target.id,
    });

    // Owning both proposals grants `profile: ADMIN` on each proposal profile —
    // which must not carry any moderation standing.
    const ownerResult = await ownerCaller.posts.listProposalComments({
      profileId: target.profileId,
    });
    expect(ownerResult.items.map((item) => item.post.id)).toEqual([clean.id]);

    // Moderation standing lives on the decision, so its admin sees the flag.
    const adminResult = await adminCaller.posts.listProposalComments({
      profileId: target.profileId,
    });
    expect(adminResult.items.map((item) => item.post.id)).toEqual([
      flagged.id,
      clean.id,
    ]);

    // The author exception is untouched: a commenter still sees their own
    // flagged comment carried onto the target.
    const commenterResult = await commenterCaller.posts.listProposalComments({
      profileId: target.profileId,
    });
    expect(commenterResult.items.map((item) => item.post.id)).toEqual([
      flagged.id,
      clean.id,
    ]);
  });

  it('gates the feed on the parent decision, not the proposal profile', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { target } = await createMergedProposalsWithComments(testData);

    const otherOrg = await testData.createDecisionSetup();
    const outsider = await testData.createMemberUser({
      organization: { id: otherOrg.organization.id },
    });
    const outsiderCaller = await createAuthenticatedCaller(outsider.email);

    await expect(
      outsiderCaller.posts.listProposalComments({
        profileId: target.profileId,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });
});

// These cells only assert the caller is admitted *past the tier gate* — i.e. the
// rejection (if any) is not an `AccessTierError`. They don't exercise a real
// resource, so a bogus profileId is enough: the open procedure lets the caller
// through and the service rejects on the missing profile, which still counts as
// passing the gate. Resource-level authorization is covered above.
describeAccessTierGating('posts.listProposalComments', {
  noJwt: accessTierGatingCell(
    'admits no-JWT caller past the tier gate',
    async ({ callers }) => {
      const caller = await callers.noJwt();
      await expectPassesAccessTierGate(
        caller.posts.listProposalComments({ profileId: 'x' }),
      );
    },
  ),

  anonJwt: accessTierGatingCell(
    'admits anon-JWT caller past the tier gate',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expectPassesAccessTierGate(
        caller.posts.listProposalComments({ profileId: 'x' }),
      );
    },
  ),

  userJwt: accessTierGatingCell(
    'admits user-JWT caller past the tier gate',
    async ({ callers }) => {
      const caller = await callers.userJwt();
      await expectPassesAccessTierGate(
        caller.posts.listProposalComments({ profileId: 'x' }),
      );
    },
  ),

  networkJwt: accessTierGatingCell(
    'admits network-JWT caller past the tier gate',
    async ({ callers }) => {
      const caller = await callers.networkJwt();
      await expectPassesAccessTierGate(
        caller.posts.listProposalComments({ profileId: 'x' }),
      );
    },
  ),
});
