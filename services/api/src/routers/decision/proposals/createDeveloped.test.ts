import {
  TestDecisionsDataManager,
  createDevelopPhaseReviewer,
  createDevelopPhaseSetup,
} from '@op/common/testing';
import { ProposalRelationshipType, ProposalStatus } from '@op/db/schema';
import { db } from '@op/db/test';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
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

describe.concurrent('createDevelopedProposal', () => {
  it('lets a category reviewer create a draft developed from a proposal of the previous phase', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, source } = await createDevelopPhaseSetup({
      testData,
    });
    const reviewer = await createDevelopPhaseReviewer({
      testData,
      setup,
      onTestFinished,
    });
    const caller = await createAuthenticatedCaller(reviewer.email);

    const draft = await caller.decision.createDevelopedProposal({
      processInstanceId: instanceId,
      sourceProposalIds: [source.id],
      proposalData: { title: 'Developed' },
    });
    testData.trackProfileForCleanup(draft.profileId);

    expect(draft.status).toBe(ProposalStatus.DRAFT);
    const edges = await db.query.proposalRelationships.findMany({
      where: {
        targetProposalId: draft.id,
        relationshipType: ProposalRelationshipType.DEVELOPED,
      },
      columns: { sourceProposalId: true },
    });
    expect(edges).toEqual([{ sourceProposalId: source.id }]);
  });
});
