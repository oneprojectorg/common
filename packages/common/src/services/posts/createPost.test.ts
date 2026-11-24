import { TestDecisionsDataManager } from '@op/common/testing';
import { db } from '@op/db/client';
import { eventOutbox } from '@op/db/schema';
import { Events } from '@op/events';
import { sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { createPost } from './createPost';

const outboxRowsForPost = async (postId: string) =>
  db
    .select()
    .from(eventOutbox)
    .where(sql`${eventOutbox.payload}->>'postId' = ${postId}`);

describe('createPost outbox write', () => {
  it('writes a proposalComment/posted outbox row with the post', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: setup.instance.instance.id,
      proposalData: { title: 'Outbox target' },
    });

    const post = await createPost({
      content: 'A comment on the proposal',
      profileId: proposal.profileId,
      proposalId: proposal.id,
      authUserId: setup.user.id,
    });

    const rows = await outboxRowsForPost(post.id);

    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.eventName).toBe(Events.proposalCommentPosted.name);
    expect(row.payload).toMatchObject({
      postId: post.id,
      proposalId: proposal.id,
    });
    expect(row.sentAt).toBeNull();
    expect(row.attempts).toBe(0);
  });

  it('writes no outbox row for a decision update', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const post = await createPost({
      content: 'An update from the admins',
      profileId: setup.instance.instance.profileId,
      authUserId: setup.user.id,
    });

    const rows = await outboxRowsForPost(post.id);

    expect(rows).toHaveLength(0);
  });
});
