import { ProposalStatus, processInstances } from '@op/db/schema';
import { db, eq } from '@op/db/test';
import { describe, expect, it } from 'vitest';

import { appRouter } from '..';
import { TestDecisionsDataManager } from '../../test/helpers/TestDecisionsDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../test/supabase-utils';
import { createCallerFactory } from '../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

/**
 * Voting schema with three phases: submission, voting, results.
 * `maxVotesPerMember` can be overridden per test by caller-side edits to the returned object.
 */
function buildVotingSchema(maxVotesPerMember?: number) {
  return {
    id: 'voting-test',
    version: '1.0.0',
    name: 'Voting Test Schema',
    description: 'Schema for voting integration tests',
    phases: [
      {
        id: 'submission',
        name: 'Submission',
        rules: {
          proposals: { submit: true },
          voting: { submit: false },
          advancement: { method: 'manual' as const },
        },
      },
      {
        id: 'voting',
        name: 'Voting',
        rules: {
          proposals: { submit: false },
          voting: {
            submit: true,
            ...(maxVotesPerMember !== undefined && { maxVotesPerMember }),
          },
          advancement: { method: 'manual' as const },
        },
      },
      {
        id: 'results',
        name: 'Results',
        rules: {
          proposals: { submit: false },
          voting: { submit: false },
          advancement: { method: 'manual' as const },
        },
      },
    ],
  };
}

async function setupVotingInstance(
  testData: TestDecisionsDataManager,
  opts: {
    maxVotesPerMember?: number;
    proposalCount: number;
    votingEnabled?: boolean;
  },
) {
  const setup = await testData.createDecisionSetup({
    instanceCount: 1,
    grantAccess: true,
    processSchema: buildVotingSchema(opts.maxVotesPerMember),
  });

  const instance = setup.instances[0];
  if (!instance) {
    throw new Error('No instance created');
  }

  const proposals = await Promise.all(
    Array.from({ length: opts.proposalCount }, (_, i) =>
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: `Proposal ${i + 1}` },
        status: ProposalStatus.SUBMITTED,
      }),
    ),
  );

  const targetPhase = opts.votingEnabled === false ? 'submission' : 'voting';
  await db
    .update(processInstances)
    .set({ currentStateId: targetPhase })
    .where(eq(processInstances.id, instance.instance.id));

  return { setup, instance, proposals };
}

describe.concurrent('submitVote', () => {
  it('rejects selection exceeding phase maxVotesPerMember', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance, proposals } = await setupVotingInstance(testData, {
      maxVotesPerMember: 2,
      proposalCount: 3,
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.decision.submitVote({
        processInstanceId: instance.instance.id,
        selectedProposalIds: proposals.map((p) => p.id),
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });
  });

  it('accepts selection at the phase maxVotesPerMember cap', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance, proposals } = await setupVotingInstance(testData, {
      maxVotesPerMember: 2,
      proposalCount: 3,
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.submitVote({
      processInstanceId: instance.instance.id,
      selectedProposalIds: proposals.slice(0, 2).map((p) => p.id),
    });

    expect(result.selectedProposalIds).toHaveLength(2);
  });

  it('treats undefined maxVotesPerMember as unlimited', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance, proposals } = await setupVotingInstance(testData, {
      maxVotesPerMember: undefined,
      proposalCount: 5,
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.submitVote({
      processInstanceId: instance.instance.id,
      selectedProposalIds: proposals.map((p) => p.id),
    });

    expect(result.selectedProposalIds).toHaveLength(5);
  });

  it('rejects voting when phase disallows voting', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance, proposals } = await setupVotingInstance(testData, {
      proposalCount: 2,
      votingEnabled: false,
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.decision.submitVote({
        processInstanceId: instance.instance.id,
        selectedProposalIds: [proposals[0]!.id],
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });
  });
});

describe.concurrent('getVotingStatus', () => {
  it('returns undefined maxVotesPerMember when phase has no cap', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance } = await setupVotingInstance(testData, {
      maxVotesPerMember: undefined,
      proposalCount: 0,
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const status = await caller.decision.getVotingStatus({
      processInstanceId: instance.instance.id,
    });

    expect(status.votingConfiguration.maxVotesPerMember).toBeUndefined();
  });

  it('returns the phase cap when set', async ({ task, onTestFinished }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance } = await setupVotingInstance(testData, {
      maxVotesPerMember: 3,
      proposalCount: 0,
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const status = await caller.decision.getVotingStatus({
      processInstanceId: instance.instance.id,
    });

    expect(status.votingConfiguration.maxVotesPerMember).toBe(3);
  });
});
