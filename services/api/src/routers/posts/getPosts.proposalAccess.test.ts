import { createPostOnProfile } from '@op/common';
import { describe, expect, it } from 'vitest';

import { appRouter } from '..';
import { TestDecisionsDataManager } from '../../test/helpers/TestDecisionsDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../test/supabase-utils';
import { createCallerFactory } from '../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

/**
 * Regression: `getPosts` authorizes with `assertProfileTypeAccess({ DECISION:
 * READ })`. A proposal's profile is type PROPOSAL, which is NOT in that policy,
 * so the check lenient-passes (no authorization at all). The READ grant lives
 * on the parent decision profile, never on the proposal — so a caller who
 * cannot read the decision must not be able to read its proposal's posts.
 *
 * FAILS against current code: an unrelated network member (a confirmed account
 * with no grant on the decision) reads a private proposal's discussion post.
 * Should pass once proposal reads are gated on the parent decision's READ (as
 * `getProposal` does via `assertInstanceProfileAccess`).
 */
describe('posts.getPosts — proposal post access', () => {
  it('does not leak a proposal post to a network member unrelated to the decision', async ({
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
    const caller = createCaller(await createTestContextWithSession(session));

    const result = await caller.posts.getPosts({
      profileId: proposal.profileId,
      parentPostId: null,
    });

    // The outsider cannot read the private decision, so its proposal's posts
    // must not be visible to them.
    expect(result.map((p) => p.id)).not.toContain(post.id);
    expect(result).toHaveLength(0);
  });
});
