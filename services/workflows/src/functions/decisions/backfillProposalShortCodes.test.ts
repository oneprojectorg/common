import { InngestTestEngine } from '@inngest/test';
import { TestDecisionsDataManager } from '@op/common/testing';
import { db, eq } from '@op/db/client';
import { ProposalStatus, processInstances, proposals } from '@op/db/schema';
import { Events } from '@op/events';
import { describe, expect, it } from 'vitest';

import { backfillProposalShortCodes } from './backfillProposalShortCodes';

const runBackfill = (data: { instanceIds?: string[] } = {}) =>
  new InngestTestEngine({
    function: backfillProposalShortCodes,
  }).execute({
    events: [{ name: Events.decisionShortCodeBackfillRequested.name, data }],
  });

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

const readCodes = async (instanceId: string) => {
  const rows = await db
    .select({ shortCode: proposals.shortCode })
    .from(proposals)
    .where(eq(proposals.processInstanceId, instanceId));
  return rows.map((row) => row.shortCode).sort();
};

describe.concurrent('backfillProposalShortCodes', () => {
  it('given legacy proposals without codes, planted by raw update, assigns codes only to the instances named in the event', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 2,
      grantAccess: true,
    });
    const [targeted, untouched] = setup.instances.map(
      (entry) => entry.instance.id,
    );
    const userEmail = setup.user.email!;

    for (const instanceId of [targeted!, untouched!]) {
      await testData.createProposal({
        userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `proposal in ${instanceId}` },
        status: ProposalStatus.SUBMITTED,
      });
      await plantLegacyUncodedState(instanceId);
    }

    const { result } = await runBackfill({ instanceIds: [targeted!] });

    expect(result).toMatchObject({
      instances: 1,
      assigned: 1,
      results: [{ instanceId: targeted, assigned: 1 }],
    });
    expect(await readCodes(targeted!)).toEqual([101]);
    expect(await readCodes(untouched!)).toEqual([null]);
  });

  it('reports zero work for an instance whose proposals already carry codes, planted by raw update', async ({
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
      proposalData: { title: 'already coded' },
      status: ProposalStatus.SUBMITTED,
    });
    await db
      .update(proposals)
      .set({ shortCode: 101 })
      .where(eq(proposals.processInstanceId, instanceId));
    await db
      .update(processInstances)
      .set({ nextShortCode: 102 })
      .where(eq(processInstances.id, instanceId));

    const { result } = await runBackfill({ instanceIds: [instanceId] });

    expect(result).toMatchObject({ instances: 0, assigned: 0 });
    expect(await readCodes(instanceId)).toEqual([101]);
  });
});
