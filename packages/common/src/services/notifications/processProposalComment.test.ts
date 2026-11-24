import { TestDecisionsDataManager } from '@op/common/testing';
import { db } from '@op/db/client';
import {
  activities,
  eventOutbox,
  notificationDeliveries,
  notifications,
} from '@op/db/schema';
import { Events } from '@op/events';
import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { describe, expect, it, onTestFinished } from 'vitest';

import { createPost } from '../posts/createPost';
import { fanOutNotifications } from './fanOutNotifications';
import {
  listUndeliveredNotifications,
  recordNotificationDeliveries,
} from './notificationDeliveries';
import { recordProposalCommentActivity } from './recordProposalCommentActivity';

const seedProposalComment = async (
  task: { id: string },
  onFinished: (fn: () => void | Promise<void>) => void,
) => {
  const testData = new TestDecisionsDataManager(task.id, onFinished);
  const setup = await testData.createDecisionSetup({
    instanceCount: 1,
    grantAccess: true,
  });
  const proposal = await testData.createProposal({
    userEmail: setup.userEmail,
    processInstanceId: setup.instance.instance.id,
    proposalData: { title: 'Fan-out target' },
  });
  const post = await createPost({
    content: 'A comment worth notifying about',
    profileId: proposal.profileId,
    proposalId: proposal.id,
    authUserId: setup.user.id,
  });
  const [outboxRow] = await db
    .select()
    .from(eventOutbox)
    .where(sql`${eventOutbox.payload}->>'postId' = ${post.id}`);
  if (!outboxRow) {
    throw new Error('Seed failed: no outbox row for the comment');
  }

  onFinished(async () => {
    await db.delete(activities).where(eq(activities.outboxId, outboxRow.id));
    await db.delete(eventOutbox).where(eq(eventOutbox.id, outboxRow.id));
  });

  const payload = Events.proposalCommentPosted.schema.parse(outboxRow.payload);

  return { setup, proposal, post, outboxRow, payload };
};

describe('recordProposalCommentActivity', () => {
  it('records the activity with scopes and snapshot, idempotent on outboxId', async ({
    task,
    onTestFinished: onFinished,
  }) => {
    const { proposal, post, outboxRow, payload } = await seedProposalComment(
      task,
      onFinished,
    );

    const first = await recordProposalCommentActivity({
      outboxId: outboxRow.id,
      ...payload,
    });
    const second = await recordProposalCommentActivity({
      outboxId: outboxRow.id,
      ...payload,
    });

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(second!.activity.id).toBe(first!.activity.id);

    const { activity, context } = first!;
    expect(activity.eventName).toBe(Events.proposalCommentPosted.name);
    expect(activity.proposalId).toBe(proposal.id);
    expect(activity.postId).toBe(post.id);
    expect(activity.actorProfileId).toBe(payload.authorProfileId);
    expect(activity.processInstanceId).toBe(proposal.processInstanceId);
    expect(activity.snapshot).toMatchObject({
      proposalTitle: 'Fan-out target',
      commentExcerpt: 'A comment worth notifying about',
    });
    expect(context.proposalTitle).toBe('Fan-out target');
    expect(context.submittedByProfileId).not.toBeNull();
  });

  it('returns null when the proposal is gone', async () => {
    const result = await recordProposalCommentActivity({
      outboxId: randomUUID(),
      postId: randomUUID(),
      proposalId: randomUUID(),
      authorProfileId: randomUUID(),
    });

    expect(result).toBeNull();
  });
});

describe('fanOutNotifications', () => {
  it('inserts one row per user and nothing on replay', async ({
    task,
    onTestFinished: onFinished,
  }) => {
    const { setup, outboxRow, payload } = await seedProposalComment(
      task,
      onFinished,
    );
    const recorded = await recordProposalCommentActivity({
      outboxId: outboxRow.id,
      ...payload,
    });
    const activityId = recorded!.activity.id;

    const first = await fanOutNotifications({
      activityId,
      userIds: [setup.user.id],
      category: 'proposalComment',
    });
    const second = await fanOutNotifications({
      activityId,
      userIds: [setup.user.id],
      category: 'proposalComment',
    });

    expect(first.inserted).toBe(1);
    expect(second.inserted).toBe(0);

    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.activityId, activityId));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.userId).toBe(setup.user.id);
    expect(rows[0]!.category).toBe('proposalComment');
    expect(rows[0]!.actionRequired).toBe(false);
    expect(rows[0]!.readAt).toBeNull();
  });
});

describe('notification deliveries', () => {
  it('a recorded delivery removes the notification from the undelivered list', async ({
    task,
    onTestFinished: onFinished,
  }) => {
    const { setup, outboxRow, payload } = await seedProposalComment(
      task,
      onFinished,
    );
    const recorded = await recordProposalCommentActivity({
      outboxId: outboxRow.id,
      ...payload,
    });
    const activityId = recorded!.activity.id;
    await fanOutNotifications({
      activityId,
      userIds: [setup.user.id],
      category: 'proposalComment',
    });

    const before = await listUndeliveredNotifications({
      activityId,
      channel: 'email',
    });
    expect(before).toHaveLength(1);

    await recordNotificationDeliveries([
      {
        notificationId: before[0]!.id,
        channel: 'email',
        providerMessageId: 'resend-123',
        status: 'sent',
      },
    ]);

    const after = await listUndeliveredNotifications({
      activityId,
      channel: 'email',
    });
    expect(after).toHaveLength(0);

    const deliveries = await db
      .select()
      .from(notificationDeliveries)
      .where(eq(notificationDeliveries.notificationId, before[0]!.id));
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0]!.status).toBe('sent');
  });
});
