import { TestDecisionsDataManager } from '@op/common/testing';
import { db } from '@op/db/client';
import { describe, expect, it } from 'vitest';

import { rejectProposal } from './rejectProposal';
import { submitProposal } from './submitProposal';
import { unrejectProposal } from './unrejectProposal';

const readCode = async (proposalId: string) => {
  const row = await db.query.proposals.findFirst({
    where: { id: proposalId },
    columns: { shortCode: true },
  });
  return row?.shortCode;
};

const readCounter = async (instanceId: string) => {
  const row = await db.query.processInstances.findFirst({
    where: { id: instanceId },
    columns: { nextShortCode: true },
  });
  return row?.nextShortCode;
};

describe.concurrent('submitProposal short codes', () => {
  it('given a decision with no codes yet, when two proposals are submitted one after the other, then they get 101 and 102 and the counter reads 103', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instanceId = setup.instance.instance.id;
    const first = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instanceId,
      proposalData: { title: 'First' },
    });
    const second = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instanceId,
      proposalData: { title: 'Second' },
    });

    const submittedFirst = await submitProposal({
      data: { proposalId: first.id },
      authUserId: setup.user.id,
    });
    const submittedSecond = await submitProposal({
      data: { proposalId: second.id },
      authUserId: setup.user.id,
    });

    expect(submittedFirst.shortCode).toBe(101);
    expect(submittedSecond.shortCode).toBe(102);
    await expect(readCounter(instanceId)).resolves.toBe(103);
  });

  it('given two drafts, when they are submitted at the same time, then they get distinct codes and the counter reads 103', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instanceId = setup.instance.instance.id;
    const drafts = await Promise.all(
      ['Left', 'Right'].map((title) =>
        testData.createProposal({
          userEmail: setup.userEmail,
          processInstanceId: instanceId,
          proposalData: { title },
        }),
      ),
    );

    const submitted = await Promise.all(
      drafts.map((draft) =>
        submitProposal({
          data: { proposalId: draft.id },
          authUserId: setup.user.id,
        }),
      ),
    );

    expect(submitted.map((proposal) => proposal.shortCode).sort()).toEqual([
      101, 102,
    ]);
    await expect(readCounter(instanceId)).resolves.toBe(103);
  });

  it('given a draft, when it is not submitted, then it has no code and the counter is untouched', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instanceId = setup.instance.instance.id;

    const draft = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instanceId,
      proposalData: { title: 'Still a draft' },
    });

    await expect(readCode(draft.id)).resolves.toBeNull();
    await expect(readCounter(instanceId)).resolves.toBe(101);
  });

  it('given a submitted proposal, when it is rejected and then restored, then it keeps its code and the counter does not move', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instanceId = setup.instance.instance.id;
    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instanceId,
      proposalData: { title: 'Rejected once' },
    });
    await submitProposal({
      data: { proposalId: proposal.id },
      authUserId: setup.user.id,
    });

    await rejectProposal({ proposalId: proposal.id, user: setup.user });
    await unrejectProposal({ proposalId: proposal.id, user: setup.user });

    await expect(readCode(proposal.id)).resolves.toBe(101);
    await expect(readCounter(instanceId)).resolves.toBe(102);
  });

  it('given two decisions, when each gets a submission, then both start at 101', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 2,
      grantAccess: true,
    });
    const [left, right] = setup.instances;
    if (!left || !right) {
      throw new Error('expected two instances');
    }

    const codes = await Promise.all(
      [left, right].map(async (instance) => {
        const draft = await testData.createProposal({
          userEmail: setup.userEmail,
          processInstanceId: instance.instance.id,
          proposalData: { title: `Proposal for ${instance.instance.id}` },
        });
        const submitted = await submitProposal({
          data: { proposalId: draft.id },
          authUserId: setup.user.id,
        });
        return submitted.shortCode;
      }),
    );

    expect(codes).toEqual([101, 101]);
  });
});
