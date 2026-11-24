import {
  createPost,
  fanOutNotifications,
  recordProposalCommentActivity,
} from '@op/common';
import { TestDecisionsDataManager } from '@op/common/testing';
import { db } from '@op/db/client';
import { activities, eventOutbox, notifications } from '@op/db/schema';
import { Events } from '@op/events';
import { eq, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { appRouter } from '..';
import {
  accessTierGatingCell,
  describeAccessTierGating,
  expectFailsAccessTierGate,
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

const STAMPS = [
  '2026-01-01T10:00:00.000Z',
  '2026-01-01T11:00:00.000Z',
  '2026-01-01T12:00:00.000Z',
] as const;

async function seedNotifications(
  task: { id: string },
  onFinished: (fn: () => void | Promise<void>) => void,
) {
  const testData = new TestDecisionsDataManager(task.id, onFinished);
  const setup = await testData.createDecisionSetup({
    instanceCount: 1,
    grantAccess: true,
  });
  const proposal = await testData.createProposal({
    userEmail: setup.userEmail,
    processInstanceId: setup.instance.instance.id,
    proposalData: { title: 'Notified proposal' },
  });

  const notificationIds: string[] = [];

  for (const [index, stamp] of STAMPS.entries()) {
    const post = await createPost({
      content: `Comment number ${index + 1}`,
      attachmentIds: [],
      profileId: proposal.profileId,
      proposalId: proposal.id,
      authUserId: setup.user.id,
    });
    const [outboxRow] = await db
      .select()
      .from(eventOutbox)
      .where(sql`${eventOutbox.payload}->>'postId' = ${post.id}`);
    if (!outboxRow) {
      throw new Error('Seed failed: no outbox row');
    }
    onFinished(async () => {
      await db.delete(activities).where(eq(activities.outboxId, outboxRow.id));
      await db.delete(eventOutbox).where(eq(eventOutbox.id, outboxRow.id));
    });

    const payload = Events.proposalCommentPosted.schema.parse(
      outboxRow.payload,
    );
    const recorded = await recordProposalCommentActivity({
      outboxId: outboxRow.id,
      ...payload,
    });
    await fanOutNotifications({
      activityId: recorded!.activity.id,
      userIds: [setup.user.id],
      category: 'proposalComment',
    });
    const [row] = await db
      .update(notifications)
      .set({ createdAt: stamp })
      .where(eq(notifications.activityId, recorded!.activity.id))
      .returning({ id: notifications.id });
    notificationIds.push(row!.id);
  }

  return { setup, proposal, notificationIds };
}

describe('notifications.list', () => {
  it('pages the caller’s notifications newest first', async ({
    task,
    onTestFinished,
  }) => {
    const { setup, notificationIds } = await seedNotifications(
      task,
      onTestFinished,
    );
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const page1 = await caller.notifications.list({ limit: 2 });
    expect(page1.items).toHaveLength(2);
    expect(page1.next).not.toBeNull();
    expect(page1.items.map(({ id }) => id)).toEqual([
      notificationIds[2],
      notificationIds[1],
    ]);
    expect(page1.items[0]!.category).toBe('proposalComment');
    expect(page1.items[0]!.activity.snapshot).toMatchObject({
      proposalTitle: 'Notified proposal',
      commentExcerpt: 'Comment number 3',
    });

    const page2 = await caller.notifications.list({
      limit: 2,
      cursor: page1.next,
    });
    expect(page2.items.map(({ id }) => id)).toEqual([notificationIds[0]]);
    expect(page2.next).toBeNull();
  });
});

describe('notifications read state', () => {
  it('counts unread, marks read, and scopes writes to the caller', async ({
    task,
    onTestFinished,
  }) => {
    const { setup, notificationIds } = await seedNotifications(
      task,
      onTestFinished,
    );
    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(caller.notifications.unreadCount()).resolves.toEqual({
      count: 3,
    });

    const otherData = new TestDecisionsDataManager(
      `${task.id}-other`,
      onTestFinished,
    );
    const otherSetup = await otherData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const otherCaller = await createAuthenticatedCaller(otherSetup.userEmail);
    await expect(
      otherCaller.notifications.markRead({ ids: [notificationIds[0]!] }),
    ).resolves.toEqual({ updated: 0 });

    await expect(
      caller.notifications.markRead({ ids: [notificationIds[0]!] }),
    ).resolves.toEqual({ updated: 1 });
    await expect(caller.notifications.unreadCount()).resolves.toEqual({
      count: 2,
    });

    await expect(caller.notifications.markAllRead()).resolves.toEqual({
      updated: 2,
    });
    await expect(caller.notifications.unreadCount()).resolves.toEqual({
      count: 0,
    });

    const page = await caller.notifications.list({});
    expect(page.items.every(({ readAt }) => readAt !== null)).toBe(true);
  });
});

describeAccessTierGating('notifications', {
  noJwt: accessTierGatingCell(
    'rejects no-JWT caller at the tier gate',
    async ({ callers }) => {
      const caller = await callers.noJwt();
      await expectFailsAccessTierGate(caller.notifications.list({}), 'none');
    },
  ),

  anonJwt: accessTierGatingCell(
    'rejects anon-JWT caller at the tier gate',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expectFailsAccessTierGate(caller.notifications.list({}), 'anon');
    },
  ),

  userJwt: accessTierGatingCell(
    'rejects out-of-network user-JWT caller at the tier gate',
    async ({ callers }) => {
      const caller = await callers.userJwt();
      await expectFailsAccessTierGate(caller.notifications.list({}), 'user');
    },
  ),

  networkJwt: accessTierGatingCell(
    'admits network-JWT caller past the tier gate',
    async ({ callers }) => {
      const caller = await callers.networkJwt();
      await expectPassesAccessTierGate(caller.notifications.list({}));
    },
  ),
});
