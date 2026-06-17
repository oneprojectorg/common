import { createPostOnProfile } from '@op/common';
import { describe, expect, it } from 'vitest';

import { appRouter } from '..';
import { TestDecisionsDataManager } from '../../test/helpers/TestDecisionsDataManager';
import {
  createAuthenticatedCaller,
  createIsolatedSession,
  createTestContextWithSession,
} from '../../test/supabase-utils';
import { createCallerFactory } from '../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

/**
 * A proposal's profile is type PROPOSAL, and its READ grant lives on the
 * parent decision profile — never on the proposal itself.
 *
 * `posts.getPosts` authorizes with `assertProfileTypeAccess({ DECISION: READ })`,
 * which leniently passes (does NOT authorize) any type outside that policy. So
 * before the fix it leaked private proposal posts to any network member.
 *
 * The polymorphic `posts.listProfilePosts` reader resolves the profile type on
 * the server and dispatches to a fail-CLOSED authorizer: the PROPOSAL branch
 * gates on the parent decision via `assertInstanceProfileAccess` (as
 * `getProposal` does). `posts.getPosts` now rejects PROPOSAL-typed profiles
 * outright so the leak can't reappear through that context-blind endpoint.
 */
describe('posts.listProfilePosts — proposal post access', () => {
  it('gates proposal posts on the parent decision, not the proposal profile', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    // Owner builds a PRIVATE decision (no public grant) with one proposal, and
    // posts a discussion comment on the proposal's profile.
    const setup = await testData.createDecisionSetup({ instanceCount: 1 });
    const instance = setup.instances[0]!;

    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Confidential Proposal' },
    });

    const post = await createPostOnProfile({
      content: 'Sensitive proposal discussion',
      targetProfileId: proposal.profileId,
      authUserId: setup.user.id,
    });

    // An unrelated network member: a confirmed @oneproject.org account in a
    // DIFFERENT organization, with no grant on this decision, its instance, or
    // the proposal.
    const otherOrg = await testData.createDecisionSetup();
    const outsider = await testData.createMemberUser({
      organization: { id: otherOrg.organization.id },
    });

    const { session } = await createIsolatedSession(outsider.email);
    const outsiderCaller = createCaller(
      await createTestContextWithSession(session),
    );

    // The polymorphic reader gates a PROPOSAL profile on its parent decision:
    // an outsider who can't read the decision is denied its proposal's posts.
    await expect(
      outsiderCaller.posts.listProfilePosts({
        profileId: proposal.profileId,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });

    // And the context-blind posts.getPosts now rejects PROPOSAL-typed profiles
    // outright rather than leniently passing (and leaking) them.
    await expect(
      outsiderCaller.posts.getPosts({
        profileId: proposal.profileId,
        parentPostId: null,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });

    // A member granted access to the decision instance reads the proposal's
    // posts through the polymorphic reader.
    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });
    const memberCaller = await createAuthenticatedCaller(member.email);

    const result = await memberCaller.posts.listProfilePosts({
      profileId: proposal.profileId,
    });

    expect(result.items.map((p) => p.id)).toContain(post.id);
  });
});
