import { createPostOnProfile } from '@op/common';
import { db } from '@op/db/client';
import {
  ProposalStatus,
  Visibility,
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

  it('leaves out the comments of a merged proposal the caller cannot open', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { caller, target, source, targetComment } =
      await createMergedProposalsWithComments(testData);

    await db
      .update(proposals)
      .set({ visibility: Visibility.HIDDEN })
      .where(eq(proposals.id, source.id));

    const result = await caller.posts.listProposalComments({
      profileId: target.profileId,
    });

    expect(result.items.map((item) => item.post.id)).toEqual([
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
