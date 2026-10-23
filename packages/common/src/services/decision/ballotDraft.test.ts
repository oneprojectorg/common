import { TestDecisionsDataManager } from '@op/common/testing';
import { describe, expect, it } from 'vitest';

import {
  ensureBallotDraft,
  findBallotDraft,
  findLatestBallotDraft,
  setBallotPageCursor,
} from './ballotDraft';

describe.concurrent('the ballot draft row', () => {
  it('given a voter with no draft, when a draft is ensured twice, then one empty row exists', async ({
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
    expect(first).toMatchObject({ picks: [], pageCursor: null });
  });

  it('given a draft, when the page cursor is set and cleared, then each read reflects it', async ({
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
    await ensureBallotDraft(key);

    await setBallotPageCursor({ ...key, pageCursor: 105 });
    await expect(findBallotDraft(key)).resolves.toMatchObject({
      pageCursor: 105,
    });

    await setBallotPageCursor({ ...key, pageCursor: null });
    await expect(findBallotDraft(key)).resolves.toMatchObject({
      pageCursor: null,
    });
  });

  it('given drafts in two decisions, when the latest is asked for, then it is the one touched last', async ({
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
    await ensureBallotDraft({
      processInstanceId: firstInstance!.instance.id,
      authUserId,
    });
    await ensureBallotDraft({
      processInstanceId: secondInstance!.instance.id,
      authUserId,
    });
    await setBallotPageCursor({
      processInstanceId: firstInstance!.instance.id,
      authUserId,
      pageCursor: 103,
    });

    await expect(findLatestBallotDraft({ authUserId })).resolves.toMatchObject({
      processInstanceId: firstInstance!.instance.id,
    });
  });
});
