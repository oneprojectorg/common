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

// A proposal's READ grant lives on its parent decision, never on the PROPOSAL
// profile itself. posts.getPosts used to leniently pass (and leak) the type;
// posts.listProfilePosts now gates it on the parent decision, and getPosts
// rejects PROPOSAL profiles outright.
describe('posts.listProfilePosts — proposal post access', () => {
  it('gates proposal posts on the parent decision, not the proposal profile', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

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

    // An unrelated network member in a different org, with no grant on this
    // decision, its instance, or the proposal.
    const otherOrg = await testData.createDecisionSetup();
    const outsider = await testData.createMemberUser({
      organization: { id: otherOrg.organization.id },
    });

    const { session } = await createIsolatedSession(outsider.email);
    const outsiderCaller = createCaller(
      await createTestContextWithSession(session),
    );

    await expect(
      outsiderCaller.posts.listProfilePosts({
        profileId: proposal.profileId,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });

    await expect(
      outsiderCaller.posts.getPosts({
        profileId: proposal.profileId,
        parentPostId: null,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });

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
