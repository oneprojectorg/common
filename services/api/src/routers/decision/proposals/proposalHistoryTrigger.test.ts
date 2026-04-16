import { db, desc, eq } from '@op/db/client';
import { ProposalStatus, proposalHistory, proposals } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../../test/supabase-utils';
import { createCallerFactory } from '../../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

describe.concurrent('proposal history trigger', () => {
  it('snapshot reflects submitted status after submit', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    // Create a draft proposal, then submit it (draft → submitted)
    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'History Status Check' },
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);
    await caller.decision.submitProposal({ proposalId: proposal.id });

    // The trigger-created history row should capture the SUBMITTED state
    const latestSnapshot = await db
      .select()
      .from(proposalHistory)
      .where(eq(proposalHistory.id, proposal.id))
      .orderBy(desc(proposalHistory.historyCreatedAt))
      .limit(1)
      .then((rows) => rows[0]);

    expect(latestSnapshot).toBeDefined();
    expect(latestSnapshot!.status).toBe(ProposalStatus.SUBMITTED);
  });

  it('closes the previous history range when a new snapshot is created', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Range Close Check' },
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    // First update: submit (draft → submitted) — creates snapshot #1
    await caller.decision.submitProposal({ proposalId: proposal.id });

    // Second update: change proposalData — creates snapshot #2
    await db
      .update(proposals)
      .set({ proposalData: { title: 'Range Close Check — edited' } })
      .where(eq(proposals.id, proposal.id));

    const snapshots = await db
      .select()
      .from(proposalHistory)
      .where(eq(proposalHistory.id, proposal.id))
      .orderBy(proposalHistory.historyCreatedAt);

    expect(snapshots.length).toBe(2);

    // First snapshot's range should be closed (upper bound is not null)
    expect(snapshots[0]!.validDuring.to).not.toBeNull();

    // Second snapshot's range should still be open
    expect(snapshots[1]!.validDuring.to).toBeNull();
  });

  it('does not create a history row when only updatedAt changes', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'No History Expected' },
    });

    // Touch only updatedAt — should NOT create a history row
    await db
      .update(proposals)
      .set({ updatedAt: new Date().toISOString() })
      .where(eq(proposals.id, proposal.id));

    const snapshots = await db
      .select()
      .from(proposalHistory)
      .where(eq(proposalHistory.id, proposal.id));

    expect(snapshots.length).toBe(0);
  });
});
