import { TestDecisionsDataManager } from '@op/common/testing';
import { describe, expect, it } from 'vitest';

import { ensureBallotDraft, findBallotDraft } from './ballotDraft';
import {
  ensureChatSession,
  findChatSession,
  findLatestChatSession,
  setSessionPageCursor,
} from './chatSession';

describe.concurrent('the ballot draft row', () => {
  it('given a voter with no draft, when a draft is ensured twice, then one row exists and it is identity alone', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const key = {
      processInstanceId: setup.instance.instance.id,
      authUserId: setup.user.id,
    };

    const first = await ensureBallotDraft(key);
    const second = await ensureBallotDraft(key);

    expect(second.id).toBe(first.id);
    await expect(findBallotDraft(key)).resolves.toMatchObject({
      id: first.id,
      processInstanceId: key.processInstanceId,
    });
  });
});

describe.concurrent('the chat session row', () => {
  it('given a voter with no session, when a session is ensured twice, then one row exists with no cursor', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const key = {
      processInstanceId: setup.instance.instance.id,
      authUserId: setup.user.id,
    };

    const first = await ensureChatSession(key);
    const second = await ensureChatSession(key);

    expect(second.id).toBe(first.id);
    expect(first).toMatchObject({ pageCursor: null, reopenedAt: null });
  });

  it('given a session, when the page cursor is set and cleared, then each read reflects it', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const key = {
      processInstanceId: setup.instance.instance.id,
      authUserId: setup.user.id,
    };
    await ensureChatSession(key);

    await setSessionPageCursor({ ...key, pageCursor: 105 });
    await expect(findChatSession(key)).resolves.toMatchObject({
      pageCursor: 105,
    });

    await setSessionPageCursor({ ...key, pageCursor: null });
    await expect(findChatSession(key)).resolves.toMatchObject({
      pageCursor: null,
    });
  });

  it('given sessions in two decisions, when the latest is asked for, then it is the one touched last', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 2,
      grantAccess: true,
    });
    const [firstInstance, secondInstance] = setup.instances;
    const authUserId = setup.user.id;
    await ensureChatSession({
      processInstanceId: firstInstance!.instance.id,
      authUserId,
    });
    await ensureChatSession({
      processInstanceId: secondInstance!.instance.id,
      authUserId,
    });
    await setSessionPageCursor({
      processInstanceId: firstInstance!.instance.id,
      authUserId,
      pageCursor: 103,
    });

    await expect(findLatestChatSession({ authUserId })).resolves.toMatchObject({
      processInstanceId: firstInstance!.instance.id,
    });
  });
});
