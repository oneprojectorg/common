import { db, eq } from '@op/db/client';
import { posts } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { appRouter } from '..';
import { TestDecisionsDataManager } from '../../test/helpers/TestDecisionsDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../test/supabase-utils';
import { createCallerFactory } from '../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

const createAuthenticatedCaller = async (email: string) => {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
};

const requireFirstInstance = <T extends { profileId: string }>(
  instances: T[],
): T => {
  const instance = instances[0];
  if (!instance) {
    throw new Error('No instance created');
  }
  return instance;
};

const fetchPostRoots = async (postId: string) => {
  const [row] = await db
    .select({
      rootProfileId: posts.rootProfileId,
      rootPostId: posts.rootPostId,
    })
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);
  return row;
};

describe.concurrent('post root columns: write-time resolution', () => {
  it('top-level on a decision profile sets rootProfileId to that profile, rootPostId NULL', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = requireFirstInstance(setup.instances);

    const caller = await createAuthenticatedCaller(setup.userEmail);
    const post = await caller.posts.createPost({
      content: 'Top-level on decision.',
      profileId: instance.profileId,
    });

    const roots = await fetchPostRoots(post.id);
    expect(roots?.rootProfileId).toBe(instance.profileId);
    expect(roots?.rootPostId).toBeNull();
  });

  it('top-level on an org profile sets rootProfileId to the org profile, rootPostId NULL', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 0 });

    const caller = await createAuthenticatedCaller(setup.userEmail);
    const post = await caller.posts.createPost({
      content: 'Top-level on org.',
      profileId: setup.organization.profileId,
    });

    const roots = await fetchPostRoots(post.id);
    expect(roots?.rootProfileId).toBe(setup.organization.profileId);
    expect(roots?.rootPostId).toBeNull();
  });

  it('top-level on a proposal profile resolves rootProfileId up to the parent decision profile', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = requireFirstInstance(setup.instances);

    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Test proposal' },
    });
    expect(proposal.profileId).toBeTruthy();

    const caller = await createAuthenticatedCaller(setup.userEmail);
    const post = await caller.posts.createPost({
      content: 'Comment on proposal — top-level on proposal profile.',
      profileId: proposal.profileId!,
      proposalId: proposal.id,
      processInstanceId: instance.instance.id,
    });

    const roots = await fetchPostRoots(post.id);
    expect(roots?.rootProfileId).toBe(instance.profileId);
    expect(roots?.rootProfileId).not.toBe(proposal.profileId);
    expect(roots?.rootPostId).toBeNull();
  });

  it('comment on a top-level post inherits rootProfileId and points rootPostId at the parent', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = requireFirstInstance(setup.instances);

    const caller = await createAuthenticatedCaller(setup.userEmail);
    const topLevel = await caller.posts.createPost({
      content: 'Original update.',
      profileId: instance.profileId,
    });
    const comment = await caller.posts.createPost({
      content: 'Comment on the update.',
      parentPostId: topLevel.id,
    });

    const topRoots = await fetchPostRoots(topLevel.id);
    const commentRoots = await fetchPostRoots(comment.id);

    expect(topRoots?.rootProfileId).toBe(instance.profileId);
    expect(topRoots?.rootPostId).toBeNull();
    expect(commentRoots?.rootProfileId).toBe(instance.profileId);
    expect(commentRoots?.rootPostId).toBe(topLevel.id);
  });

  it('reply to a comment inherits the original top-level as rootPostId (deep thread)', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = requireFirstInstance(setup.instances);

    const caller = await createAuthenticatedCaller(setup.userEmail);
    const topLevel = await caller.posts.createPost({
      content: 'Top-level.',
      profileId: instance.profileId,
    });
    const comment = await caller.posts.createPost({
      content: 'Comment.',
      parentPostId: topLevel.id,
    });
    const reply = await caller.posts.createPost({
      content: 'Reply to comment.',
      parentPostId: comment.id,
    });

    const replyRoots = await fetchPostRoots(reply.id);
    expect(replyRoots?.rootProfileId).toBe(instance.profileId);
    // Reply's rootPostId is the ORIGINAL top-level, not its immediate parent.
    expect(replyRoots?.rootPostId).toBe(topLevel.id);
    expect(replyRoots?.rootPostId).not.toBe(comment.id);
  });
});
