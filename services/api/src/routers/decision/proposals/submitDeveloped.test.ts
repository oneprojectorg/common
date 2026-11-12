import { createDevelopedProposal } from '@op/common';
import {
  TestDecisionsDataManager,
  createDevelopPhaseReviewer,
  createDevelopPhaseSetup,
} from '@op/common/testing';
import { ProposalStatus } from '@op/db/schema';
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

describe.concurrent('submitDevelopedProposal', () => {
  it('lets the author submit a developed draft', async ({
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
    const draft = await createDevelopedProposal({
      data: {
        processInstanceId: instanceId,
        sourceProposalIds: [source.id],
        proposalData: { title: 'Developed' },
      },
      user: reviewer.user,
    });
    testData.trackProfileForCleanup(draft.profileId);
    const caller = await createAuthenticatedCaller(reviewer.email);

    const submitted = await caller.decision.submitDevelopedProposal({
      proposalId: draft.id,
    });

    expect(submitted.id).toBe(draft.id);
    expect(submitted.status).toBe(ProposalStatus.SUBMITTED);
  });
});
