import { TestDecisionsDataManager } from '@op/common/testing';
import { db, eq } from '@op/db/client';
import { ProposalStatus, processInstances, proposals } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import {
  backfillInstanceShortCodes,
  listInstancesNeedingShortCodes,
} from './backfillShortCodes';

const readCodes = async (instanceId: string) => {
  const rows = await db
    .select({
      title: proposals.proposalData,
      shortCode: proposals.shortCode,
      status: proposals.status,
    })
    .from(proposals)
    .where(eq(proposals.processInstanceId, instanceId));
  return rows.map((row) => ({
    title: (row.title as { title: string }).title,
    shortCode: row.shortCode,
    status: row.status,
  }));
};

const readCounter = async (instanceId: string) => {
  const [row] = await db
    .select({ nextShortCode: processInstances.nextShortCode })
    .from(processInstances)
    .where(eq(processInstances.id, instanceId));
  return row?.nextShortCode;
};

const plantLegacyUncodedState = async (instanceId: string) => {
  await db
    .update(proposals)
    .set({ shortCode: null })
    .where(eq(proposals.processInstanceId, instanceId));
  await db
    .update(processInstances)
    .set({ nextShortCode: 101 })
    .where(eq(processInstances.id, instanceId));
};

describe.concurrent('backfillInstanceShortCodes', () => {
  it('given proposals submitted before codes existed, planted by raw update, assigns sequential codes in creation order and skips drafts', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instanceId = setup.instances[0]!.instance.id;
    const userEmail = setup.user.email!;

    const base = Date.now();
    for (const [index, title] of ['first', 'second', 'third'].entries()) {
      await testData.createProposal({
        userEmail,
        processInstanceId: instanceId,
        proposalData: { title },
        status: ProposalStatus.SUBMITTED,
        createdAt: new Date(base + index * 1000),
      });
    }
    await testData.createProposal({
      userEmail,
      processInstanceId: instanceId,
      proposalData: { title: 'still a draft' },
      status: ProposalStatus.DRAFT,
      createdAt: new Date(base + 3000),
    });
    await plantLegacyUncodedState(instanceId);

    const result = await backfillInstanceShortCodes({ instanceId });

    expect(result).toEqual({ assigned: 3, nextShortCode: 104 });

    const rows = await readCodes(instanceId);
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: 'first', shortCode: 101 }),
        expect.objectContaining({ title: 'second', shortCode: 102 }),
        expect.objectContaining({ title: 'third', shortCode: 103 }),
        expect.objectContaining({ title: 'still a draft', shortCode: null }),
      ]),
    );
    expect(await readCounter(instanceId)).toBe(104);
  });

  it('assigns nothing on a second run and leaves codes unchanged', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instanceId = setup.instances[0]!.instance.id;

    await testData.createProposal({
      userEmail: setup.user.email!,
      processInstanceId: instanceId,
      proposalData: { title: 'only one' },
      status: ProposalStatus.SUBMITTED,
    });
    await plantLegacyUncodedState(instanceId);

    await backfillInstanceShortCodes({ instanceId });
    const second = await backfillInstanceShortCodes({ instanceId });

    expect(second.assigned).toBe(0);
    const rows = await readCodes(instanceId);
    expect(rows).toEqual([
      expect.objectContaining({ title: 'only one', shortCode: 101 }),
    ]);
    expect(await readCounter(instanceId)).toBe(102);
  });

  it('continues numbering after a code planted by raw update, simulating an earlier partial run no service produces', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instanceId = setup.instances[0]!.instance.id;
    const userEmail = setup.user.email!;

    const base = Date.now();
    const coded = await testData.createProposal({
      userEmail,
      processInstanceId: instanceId,
      proposalData: { title: 'already coded' },
      status: ProposalStatus.SUBMITTED,
      createdAt: new Date(base),
    });
    await testData.createProposal({
      userEmail,
      processInstanceId: instanceId,
      proposalData: { title: 'missing a code' },
      status: ProposalStatus.SUBMITTED,
      createdAt: new Date(base + 1000),
    });

    await plantLegacyUncodedState(instanceId);
    await db
      .update(proposals)
      .set({ shortCode: 101 })
      .where(eq(proposals.id, coded.id));
    await db
      .update(processInstances)
      .set({ nextShortCode: 102 })
      .where(eq(processInstances.id, instanceId));

    const result = await backfillInstanceShortCodes({ instanceId });

    expect(result).toEqual({ assigned: 1, nextShortCode: 103 });
    const rows = await readCodes(instanceId);
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: 'already coded', shortCode: 101 }),
        expect.objectContaining({ title: 'missing a code', shortCode: 102 }),
      ]),
    );
  });
});

describe.concurrent('listInstancesNeedingShortCodes', () => {
  it('lists an instance only while it still has uncoded eligible proposals', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 2,
      grantAccess: true,
    });
    const [withProposals, withoutProposals] = setup.instances.map(
      (entry) => entry.instance.id,
    );

    await testData.createProposal({
      userEmail: setup.user.email!,
      processInstanceId: withProposals!,
      proposalData: { title: 'needs a code' },
      status: ProposalStatus.SUBMITTED,
    });
    await plantLegacyUncodedState(withProposals!);

    const before = await listInstancesNeedingShortCodes();
    expect(before).toContainEqual({ instanceId: withProposals, missing: 1 });
    expect(before.map((row) => row.instanceId)).not.toContain(withoutProposals);

    await backfillInstanceShortCodes({ instanceId: withProposals! });

    const after = await listInstancesNeedingShortCodes();
    expect(after.map((row) => row.instanceId)).not.toContain(withProposals);
  });
});
