import { TestDecisionsDataManager } from '@op/common/testing';
import { db } from '@op/db/client';
import { smsMessages } from '@op/db/schema';
import { inArray } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  appendConversationItems,
  ensureConversation,
  listRecentReplayMessages,
  startNewConversation,
} from './conversation';
import { recordSmsMessage } from './smsMessageLog';

const seedVoter = async (testData: TestDecisionsDataManager) => {
  const setup = await testData.createDecisionSetup({
    instanceCount: 1,
    grantAccess: true,
  });
  return {
    authUserId: setup.user.id,
    processInstanceId: setup.instance.instance.id,
  };
};

describe.concurrent('conversations service', () => {
  it('given a voter asks twice in one decision, then both asks share one conversation', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { authUserId, processInstanceId } = await seedVoter(testData);

    const first = await ensureConversation({ authUserId, processInstanceId });
    const second = await ensureConversation({ authUserId, processInstanceId });

    expect(second.id).toBe(first.id);
    expect(first.processInstanceId).toBe(processInstanceId);
  });

  it('given a run of items is appended, then replay returns the message items in order and skips tool items', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { authUserId, processInstanceId } = await seedVoter(testData);
    const conversation = await ensureConversation({
      authUserId,
      processInstanceId,
    });

    const runId = randomUUID();
    const items = await appendConversationItems({
      conversationId: conversation.id,
      runId,
      items: [
        { message: { role: 'user', content: 'L add 101' } },
        {
          message: {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'add_picks',
                input: { codes: [101] },
              },
            ],
          },
          agentId: 'sms-voting-assistant',
        },
        {
          message: {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolCallId: 'call-1',
                toolName: 'add_picks',
                output: { type: 'json', value: { added: [101] } },
              },
            ],
          },
          agentId: 'sms-voting-assistant',
        },
        {
          message: { role: 'assistant', content: 'Added 101.' },
          agentId: 'sms-voting-assistant',
          promptVersion: 'v1',
        },
      ],
    });

    expect(items.map((item) => item.kind)).toEqual([
      'message',
      'tool_call',
      'tool_output',
      'message',
    ]);
    expect(items.every((item) => item.runId === runId)).toBe(true);

    const replay = await listRecentReplayMessages({
      conversationId: conversation.id,
    });
    expect(replay).toEqual([
      { role: 'user', content: 'L add 101' },
      { role: 'assistant', content: 'Added 101.' },
    ]);
  });

  it('given more messages than the window, then replay keeps the newest ones in order', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { authUserId, processInstanceId } = await seedVoter(testData);
    const conversation = await ensureConversation({
      authUserId,
      processInstanceId,
    });

    for (let turn = 0; turn < 4; turn++) {
      await appendConversationItems({
        conversationId: conversation.id,
        runId: randomUUID(),
        items: [
          { message: { role: 'user', content: `question ${turn}` } },
          { message: { role: 'assistant', content: `answer ${turn}` } },
        ],
      });
    }

    const replay = await listRecentReplayMessages({
      conversationId: conversation.id,
      limit: 4,
    });
    expect(replay).toEqual([
      { role: 'user', content: 'question 2' },
      { role: 'assistant', content: 'answer 2' },
      { role: 'user', content: 'question 3' },
      { role: 'assistant', content: 'answer 3' },
    ]);
  });

  it('given a new conversation is started for a decision, then the thread moves and the old one stays stored', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { authUserId, processInstanceId } = await seedVoter(testData);

    const first = await ensureConversation({ authUserId, processInstanceId });
    await appendConversationItems({
      conversationId: first.id,
      runId: randomUUID(),
      items: [{ message: { role: 'user', content: 'old thread turn' } }],
    });

    const fresh = await startNewConversation({ authUserId, processInstanceId });
    expect(fresh.id).not.toBe(first.id);

    const reused = await ensureConversation({ authUserId, processInstanceId });
    expect(reused.id).toBe(fresh.id);

    await expect(
      listRecentReplayMessages({ conversationId: fresh.id }),
    ).resolves.toEqual([]);
    await expect(
      db.query.conversationItems.findMany({
        where: { conversationId: first.id },
      }),
    ).resolves.toHaveLength(1);
  });

  it('given the same provider sid is recorded twice, then one row exists', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { authUserId } = await seedVoter(testData);
    const sid = `SM-${task.id}`;

    const first = await recordSmsMessage({
      direction: 'inbound',
      body: 'L how do I vote?',
      authUserId,
      counterpartE164: '+17405550111',
      providerSid: sid,
    });
    const second = await recordSmsMessage({
      direction: 'inbound',
      body: 'L how do I vote?',
      authUserId,
      counterpartE164: '+17405550111',
      providerSid: sid,
    });
    onTestFinished(async () => {
      await db
        .delete(smsMessages)
        .where(inArray(smsMessages.id, [first.id, second.id]));
    });

    expect(second.id).toBe(first.id);
  });

  it('given a conversation is deleted with its profile, then its items go too', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { authUserId, processInstanceId } = await seedVoter(testData);
    const conversation = await ensureConversation({
      authUserId,
      processInstanceId,
    });
    await appendConversationItems({
      conversationId: conversation.id,
      runId: randomUUID(),
      items: [{ message: { role: 'user', content: 'hello' } }],
    });

    await testData.cleanup();

    await expect(
      db.query.conversationItems.findMany({
        where: { conversationId: conversation.id },
      }),
    ).resolves.toEqual([]);
    expect(
      await db.query.conversations.findFirst({
        where: { id: conversation.id },
      }),
    ).toBeUndefined();
  });
});
