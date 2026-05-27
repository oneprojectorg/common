import { ProposalStatus, processInstances } from '@op/db/schema';
import { db, eq } from '@op/db/test';
import { describe, expect, it } from 'vitest';

import { appRouter } from '..';
import { TestDecisionsDataManager } from '../../test/helpers/TestDecisionsDataManager';
import {
  createIsolatedSession,
  createIsolatedTestClient,
  createTestContextWithSession,
} from '../../test/supabase-utils';
import { createCallerFactory } from '../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

async function createAnonymousCaller() {
  const client = createIsolatedTestClient();
  const { data, error } = await client.auth.signInAnonymously();
  if (error || !data.session) {
    throw new Error(`Failed to sign in anonymously: ${error?.message}`);
  }
  return createCaller(await createTestContextWithSession(data.session));
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

  // Public-mode gating: no-JWT / anon callers don't have personal votes,
  // but they should still be able to read the voting configuration on a
  // public instance (so the UI can render the read-only voting summary).
  describe('public-mode gating', () => {
    it('allows a no-JWT caller to read voting status on a public instance', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const { instance } = await setupVotingInstance(testData, {
        proposalCount: 0,
      });
      await testData.setInstancePublic(instance.instance.id);

      const noJwtCaller = createCaller(
        await createTestContextWithSession(null),
      );

      const status = await noJwtCaller.decision.getVotingStatus({
        processInstanceId: instance.instance.id,
      });

      expect(status.hasVoted).toBe(false);
      expect(status.voteSubmission).toBeNull();
      expect(status.votingConfiguration).toBeDefined();
    });

    it('allows an anonymous JWT to read voting status on a public instance', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const { instance } = await setupVotingInstance(testData, {
        proposalCount: 0,
      });
      await testData.setInstancePublic(instance.instance.id);

      const anonCaller = await createAnonymousCaller();

      const status = await anonCaller.decision.getVotingStatus({
        processInstanceId: instance.instance.id,
      });

      expect(status.hasVoted).toBe(false);
      expect(status.voteSubmission).toBeNull();
      expect(status.votingConfiguration).toBeDefined();
    });

    it('rejects a no-JWT caller on a non-public instance', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const { instance } = await setupVotingInstance(testData, {
        proposalCount: 0,
      });

      const noJwtCaller = createCaller(
        await createTestContextWithSession(null),
      );

      await expect(
        noJwtCaller.decision.getVotingStatus({
          processInstanceId: instance.instance.id,
        }),
      ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
    });

    it('rejects an anonymous JWT on a non-public instance', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const { instance } = await setupVotingInstance(testData, {
        proposalCount: 0,
      });

      const anonCaller = await createAnonymousCaller();

      await expect(
        anonCaller.decision.getVotingStatus({
          processInstanceId: instance.instance.id,
        }),
      ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
    });
  });
});
