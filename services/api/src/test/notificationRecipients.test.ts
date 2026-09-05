import { db, eq } from '@op/db/client';
import {
  ProcessStatus,
  posts,
  postsToOrganizations,
  profiles,
} from '@op/db/schema';
import { describe, expect, it, vi } from 'vitest';

import { OPBatchSend } from '../../../emails/index';
import { TestDecisionsDataManager } from './helpers/TestDecisionsDataManager';
import { TestOrganizationDataManager } from './helpers/TestOrganizationDataManager';

type WorkflowInput = {
  event: { data: Record<string, string> };
  runId: string;
  step: { run: <T>(id: string, fn: () => Promise<T>) => Promise<T> };
};

// Exercise the actual workflow and SQL; only Inngest execution and email
// delivery are replaced so the test cannot send real notifications.
const { handlers } = vi.hoisted(() => ({
  handlers: new Map<string, (input: WorkflowInput) => Promise<unknown>>(),
}));

vi.mock('@op/events', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@op/events')>();
  return {
    ...actual,
    event: { send: vi.fn().mockResolvedValue({ ids: [] }) },
    inngest: {
      send: vi.fn().mockResolvedValue({ ids: [] }),
      createFunction: (
        config: { id: string },
        _trigger: unknown,
        handler: (input: WorkflowInput) => Promise<unknown>,
      ) => {
        handlers.set(config.id, handler);
        return handler;
      },
    },
  };
});

vi.mock('../../../emails/index', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../emails/index')>()),
  OPBatchSend: vi.fn().mockResolvedValue({ data: [], errors: [] }),
}));

import '../../../workflows/src/functions/notifications/sendDecisionUpdateNotification';
import '../../../workflows/src/functions/notifications/sendPostCommentNotification';

async function runWorkflow(id: string, data: Record<string, string>) {
  const handler = handlers.get(id);
  if (!handler) {
    throw new Error(`Workflow not registered: ${id}`);
  }
  return handler({
    event: { data },
    runId: 'test-run',
    step: { run: async (_id, fn) => fn() },
  });
}

function sentAddresses() {
  return vi
    .mocked(OPBatchSend)
    .mock.calls.flatMap(([emails]) => emails.map(({ to }) => to));
}

describe('notification delivery audiences', () => {
  it('includes a decision update author in the participant audience at their sign-in address', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      status: ProcessStatus.PUBLISHED,
    });
    const author = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [setup.instance.profileId],
    });
    // Matching contact/sign-in addresses must not cause the author to be excluded.
    await db
      .update(profiles)
      .set({ email: author.email })
      .where(eq(profiles.id, author.profileId));
    const [post] = await db
      .insert(posts)
      .values({ content: 'The city update', profileId: author.profileId })
      .returning();
    if (!post) throw new Error('Post not created');

    await runWorkflow('sendDecisionUpdateNotification', {
      postId: post.id,
      targetProfileId: setup.instance.profileId,
      authorProfileId: author.profileId,
    });

    expect(sentAddresses().sort()).toEqual(
      [setup.userEmail, author.email].sort(),
    );
  });

  it.for(['organization', 'individual'])(
    'sends comments on %s posts to the correct accounts',
    async (authorKind, { task, onTestFinished }) => {
      const testData = new TestOrganizationDataManager(task.id, onTestFinished);
      const { organization, organizationProfile, adminUsers, memberUsers } =
        await testData.createOrganization({ users: { admin: 2, member: 1 } });
      const author = adminUsers[0];
      const commenter = memberUsers[0];
      if (!author || !commenter) throw new Error('Test users missing');
      await db
        .update(profiles)
        .set({ email: 'unverified-contact@example.com' })
        .where(eq(profiles.id, author.profileId));
      const [parent] = await db
        .insert(posts)
        .values({
          content: 'Original post',
          profileId: authorKind === 'individual' ? author.profileId : null,
          rootProfileId: organizationProfile.id,
        })
        .returning();
      if (!parent) throw new Error('Parent not created');
      await db
        .insert(postsToOrganizations)
        .values({ postId: parent.id, organizationId: organization.id });
      const [comment] = await db
        .insert(posts)
        .values({
          content: 'A reply',
          parentPostId: parent.id,
          profileId: commenter.profileId,
        })
        .returning();
      if (!comment) throw new Error('Comment not created');

      await runWorkflow('sendPostCommentNotification', {
        postId: comment.id,
        parentPostId: parent.id,
        authorProfileId: commenter.profileId,
      });

      const expected =
        authorKind === 'individual'
          ? [author.email]
          : adminUsers.map(({ email }) => email);
      expect(sentAddresses().sort()).toEqual(expected.sort());
    },
  );
});
