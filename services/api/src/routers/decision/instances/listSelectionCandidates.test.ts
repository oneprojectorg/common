import { db, eq, inArray, sql } from '@op/db/client';
import {
  ProcessStatus,
  ProposalStatus,
  decisionTransitionProposals,
  decisionsVoteProposals,
  decisionsVoteSubmissions,
  processInstances,
  proposals,
  stateTransitionHistory,
} from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import {
  accessTierGatingCell,
  describeDecisionAccessTierGating,
  expectFailsAccessTierGate,
} from '../../../test/helpers/gating/decision';
import { schemaWithoutPipeline } from '../../../test/helpers/pipelineSchemas';
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

async function seedInstance(testData: TestDecisionsDataManager): Promise<{
  instanceId: string;
  instanceProfileId: string;
  userEmail: string;
  organization: DecisionSetupOrganization;
  caller: Awaited<ReturnType<typeof createAuthenticatedCaller>>;
}> {
  const setup = await testData.createDecisionSetup({
    processSchema: schemaWithoutPipeline,
    instanceCount: 1,
    status: ProcessStatus.PUBLISHED,
  });
  const instance = setup.instance;
  const caller = await createAuthenticatedCaller(setup.userEmail);
  return {
    instanceId: instance.instance.id,
    instanceProfileId: instance.profileId,
    userEmail: setup.userEmail,
    organization: setup.organization,
    caller,
  };
}

type DecisionSetupOrganization = Awaited<
  ReturnType<TestDecisionsDataManager['createDecisionSetup']>
>['organization'];

/**
 * Inserts one ballot (vote submission + N vote-proposal join rows) for a single
 * voter. The unique constraint on (processInstanceId, submittedByProfileId)
 * means each voter can submit only once per instance — callers must supply a
 * fresh voter profileId per call.
 */
async function seedBallot({
  processInstanceId,
  voterProfileId,
  proposalIds,
}: {
  processInstanceId: string;
  voterProfileId: string;
  proposalIds: string[];
}) {
  const [submission] = await db
    .insert(decisionsVoteSubmissions)
    .values({
      processInstanceId,
      submittedByProfileId: voterProfileId,
      voteData: {
        schemaVersion: '1.0.0',
        schemaType: 'simple',
        submissionMetadata: { timestamp: new Date().toISOString() },
        validationSignature: 'test-signature',
      },
    })
    .returning({ id: decisionsVoteSubmissions.id });

  if (!submission) {
    throw new Error('Failed to seed vote submission');
  }

  if (proposalIds.length > 0) {
    await db.insert(decisionsVoteProposals).values(
      proposalIds.map((proposalId) => ({
        voteSubmissionId: submission.id,
        proposalId,
      })),
    );
  }
}

describe.concurrent('listSelectionCandidates', () => {
  it('returns candidates from the previous phase when awaiting manual selection', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, userEmail, caller } = await seedInstance(testData);
    const submitted = await testData.createProposal({
      userEmail,
      processInstanceId: instanceId,
      proposalData: { title: `Candidate ${task.id}` },
      status: ProposalStatus.SUBMITTED,
    });

    await testData.advancePhase({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'review',
    });
    await db
      .delete(decisionTransitionProposals)
      .where(eq(decisionTransitionProposals.processInstanceId, instanceId));

    const result = await caller.decision.listSelectionCandidates({
      processInstanceId: instanceId,
    });

    expect(result.items.map((p) => p.id)).toContain(submitted.id);
  });

  it('still returns candidates after a manual-selection stamp exists (state gating lives on getInstance)', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, userEmail, caller } = await seedInstance(testData);
    await testData.createProposal({
      userEmail,
      processInstanceId: instanceId,
      proposalData: { title: `Candidate ${task.id}` },
      status: ProposalStatus.SUBMITTED,
    });

    await testData.advancePhase({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'review',
    });

    const [transition] = await db
      .select({ id: stateTransitionHistory.id })
      .from(stateTransitionHistory)
      .where(eq(stateTransitionHistory.processInstanceId, instanceId));

    if (!transition) {
      throw new Error('Expected stateTransitionHistory row to exist');
    }

    await db
      .update(stateTransitionHistory)
      .set({
        transitionData: {
          manualSelection: {
            byProfileId: '00000000-0000-4000-8000-000000000001',
            at: new Date().toISOString(),
          },
        },
      })
      .where(eq(stateTransitionHistory.id, transition.id));

    const result = await caller.decision.listSelectionCandidates({
      processInstanceId: instanceId,
    });

    expect(result.items.length).toBeGreaterThan(0);
  });

  it('returns empty when the instance is still in the first phase', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, caller } = await seedInstance(testData);

    const result = await caller.decision.listSelectionCandidates({
      processInstanceId: instanceId,
    });

    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.next).toBeNull();
  });

  it('returns empty for a legacy instance (no phase model)', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, caller } = await seedInstance(testData);

    await db
      .update(processInstances)
      .set({
        instanceData: sql`${processInstances.instanceData} || jsonb_build_object('currentStateId', 'review')`,
      })
      .where(eq(processInstances.id, instanceId));

    await db.insert(stateTransitionHistory).values({
      processInstanceId: instanceId,
      fromStateId: 'submission',
      toStateId: 'review',
    });

    const result = await caller.decision.listSelectionCandidates({
      processInstanceId: instanceId,
    });

    expect(result.items).toEqual([]);
  });

  it('rejects callers without admin access on the instance', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId } = await seedInstance(testData);

    const outsiderSetup = await testData.createDecisionSetup({
      instanceCount: 0,
    });
    const outsiderCaller = await createAuthenticatedCaller(
      outsiderSetup.userEmail,
    );

    await expect(
      outsiderCaller.decision.listSelectionCandidates({
        processInstanceId: instanceId,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });

  it('paginates the newest sort without skipping rows that share a boundary timestamp', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, userEmail, caller } = await seedInstance(testData);

    const seeded = await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        testData.createProposal({
          userEmail,
          processInstanceId: instanceId,
          proposalData: { title: `Paged ${index} ${task.id}` },
          status: ProposalStatus.SUBMITTED,
        }),
      ),
    );
    const seededIds = seeded.map((p) => p.id);

    // Identical createdAt across the page boundary makes the `id` tie-breaker
    // load-bearing: without it, rows would be skipped or duplicated between
    // pages.
    await db
      .update(proposals)
      .set({ createdAt: '2026-01-01 00:00:00+00' })
      .where(inArray(proposals.id, seededIds));

    await testData.advancePhase({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'review',
    });

    const pagedIds: string[] = [];
    let cursor: string | null | undefined;
    let pages = 0;
    let total = 0;
    do {
      const page = await caller.decision.listSelectionCandidates({
        processInstanceId: instanceId,
        sortOrder: 'newest',
        limit: 2,
        cursor,
      });
      pagedIds.push(...page.items.map((p) => p.id));
      total = page.total;
      cursor = page.next;
      pages += 1;
    } while (cursor && pages < 10);

    expect(new Set(pagedIds).size).toBe(pagedIds.length);
    expect(pagedIds.length).toBe(total);
    for (const id of seededIds) {
      expect(pagedIds.filter((pagedId) => pagedId === id)).toHaveLength(1);
    }
  });

  it('paginates the votes sort via offset so candidates past the first page stay reachable', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, instanceProfileId, userEmail, organization, caller } =
      await seedInstance(testData);

    const [high, mid, zero] = await Promise.all([
      testData.createProposal({
        userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `High ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      }),
      testData.createProposal({
        userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `Mid ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      }),
      testData.createProposal({
        userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `Zero ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      }),
    ]);

    await testData.advancePhase({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'review',
    });

    const [voterA, voterB] = await Promise.all([
      testData.createMemberUser({
        organization,
        instanceProfileIds: [instanceProfileId],
      }),
      testData.createMemberUser({
        organization,
        instanceProfileIds: [instanceProfileId],
      }),
    ]);

    await Promise.all([
      seedBallot({
        processInstanceId: instanceId,
        voterProfileId: voterA.profileId,
        proposalIds: [high.id],
      }),
      seedBallot({
        processInstanceId: instanceId,
        voterProfileId: voterB.profileId,
        proposalIds: [high.id, mid.id],
      }),
    ]);

    const firstPage = await caller.decision.listSelectionCandidates({
      processInstanceId: instanceId,
      sortOrder: 'votes',
      limit: 2,
    });

    expect(firstPage.items).toHaveLength(2);
    expect(firstPage.total).toBeGreaterThanOrEqual(3);
    expect(firstPage.next).not.toBeNull();

    const pagedIds = [...firstPage.items.map((p) => p.id)];
    let cursor = firstPage.next;
    let pages = 1;
    while (cursor && pages < 10) {
      const page = await caller.decision.listSelectionCandidates({
        processInstanceId: instanceId,
        sortOrder: 'votes',
        limit: 2,
        cursor,
      });
      pagedIds.push(...page.items.map((p) => p.id));
      cursor = page.next;
      pages += 1;
    }

    expect(new Set(pagedIds).size).toBe(pagedIds.length);
    expect(pagedIds.length).toBe(firstPage.total);
    // Vote ordering holds across page boundaries: high (2) → mid (1) → zero (0).
    expect(pagedIds.indexOf(high.id)).toBeLessThan(pagedIds.indexOf(mid.id));
    expect(pagedIds.indexOf(mid.id)).toBeLessThan(pagedIds.indexOf(zero.id));
  });

  it('orders candidates by descending vote count when sortOrder is "votes"', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, instanceProfileId, userEmail, organization, caller } =
      await seedInstance(testData);

    const [low, high, mid, zero] = await Promise.all([
      testData.createProposal({
        userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `Low ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      }),
      testData.createProposal({
        userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `High ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      }),
      testData.createProposal({
        userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `Mid ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      }),
      testData.createProposal({
        userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `Zero ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      }),
    ]);

    await testData.advancePhase({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'review',
    });

    // 3 distinct voters so the unique-per-instance constraint isn't violated.
    // Ballots overlap to produce counts high=3, mid=2, low=1, zero=0.
    const [voterA, voterB, voterC] = await Promise.all([
      testData.createMemberUser({
        organization,
        instanceProfileIds: [instanceProfileId],
      }),
      testData.createMemberUser({
        organization,
        instanceProfileIds: [instanceProfileId],
      }),
      testData.createMemberUser({
        organization,
        instanceProfileIds: [instanceProfileId],
      }),
    ]);

    await Promise.all([
      seedBallot({
        processInstanceId: instanceId,
        voterProfileId: voterA.profileId,
        proposalIds: [high.id],
      }),
      seedBallot({
        processInstanceId: instanceId,
        voterProfileId: voterB.profileId,
        proposalIds: [high.id, mid.id],
      }),
      seedBallot({
        processInstanceId: instanceId,
        voterProfileId: voterC.profileId,
        proposalIds: [high.id, mid.id, low.id],
      }),
    ]);

    const result = await caller.decision.listSelectionCandidates({
      processInstanceId: instanceId,
      sortOrder: 'votes',
    });

    const seededIds = new Set([low.id, high.id, mid.id, zero.id]);
    const seededOnly = result.items.filter((p) => seededIds.has(p.id));

    expect(seededOnly.map((p) => p.id)).toEqual([
      high.id,
      mid.id,
      low.id,
      zero.id,
    ]);
    const byId = new Map(seededOnly.map((p) => [p.id, p]));
    expect(byId.get(high.id)?.voteCount).toBe(3);
    expect(byId.get(mid.id)?.voteCount).toBe(2);
    expect(byId.get(low.id)?.voteCount).toBe(1);
    expect(byId.get(zero.id)?.voteCount).toBe(0);
  });

  it('vote-count aggregation ignores submissions from other process instances', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, instanceProfileId, userEmail, organization, caller } =
      await seedInstance(testData);

    const otherSetup = await testData.createDecisionSetup({
      processSchema: schemaWithoutPipeline,
      instanceCount: 1,
      status: ProcessStatus.PUBLISHED,
    });
    const otherInstance = otherSetup.instance;

    const proposal = await testData.createProposal({
      userEmail,
      processInstanceId: instanceId,
      proposalData: { title: `Cross-instance vote target ${task.id}` },
      status: ProposalStatus.SUBMITTED,
    });

    await testData.advancePhase({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'review',
    });

    // 2 voters in `instanceId` (expected count = 2); 1 voter in the other
    // instance also votes for the same proposal — must be excluded from the
    // count by the join's processInstanceId predicate.
    const [voterA, voterB, otherVoter] = await Promise.all([
      testData.createMemberUser({
        organization,
        instanceProfileIds: [instanceProfileId],
      }),
      testData.createMemberUser({
        organization,
        instanceProfileIds: [instanceProfileId],
      }),
      testData.createMemberUser({
        organization: otherSetup.organization,
        instanceProfileIds: [otherInstance.profileId],
      }),
    ]);

    await Promise.all([
      seedBallot({
        processInstanceId: instanceId,
        voterProfileId: voterA.profileId,
        proposalIds: [proposal.id],
      }),
      seedBallot({
        processInstanceId: instanceId,
        voterProfileId: voterB.profileId,
        proposalIds: [proposal.id],
      }),
      seedBallot({
        processInstanceId: otherInstance.instance.id,
        voterProfileId: otherVoter.profileId,
        proposalIds: [proposal.id],
      }),
    ]);

    const result = await caller.decision.listSelectionCandidates({
      processInstanceId: instanceId,
      sortOrder: 'votes',
    });

    const found = result.items.find((p) => p.id === proposal.id);
    expect(found?.voteCount).toBe(2);
  });
});

describeDecisionAccessTierGating('listSelectionCandidates', {
  noJwtNonPublic: accessTierGatingCell(
    'rejects no-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instance;

      const caller = await callers.noJwt();

      await expectFailsAccessTierGate(
        caller.decision.listSelectionCandidates({
          processInstanceId: instance.instance.id,
          sortOrder: 'votes',
        }),
        'none',
      );
    },
  ),

  anonJwtNonPublic: accessTierGatingCell(
    'rejects anon-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instance;

      const caller = await callers.anonJwt();

      await expectFailsAccessTierGate(
        caller.decision.listSelectionCandidates({
          processInstanceId: instance.instance.id,
          sortOrder: 'votes',
        }),
        'anon',
      );
    },
  ),

  userJwtNonPublic: accessTierGatingCell(
    'rejects user-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instance;

      const caller = await callers.userJwt();

      await expectFailsAccessTierGate(
        caller.decision.listSelectionCandidates({
          processInstanceId: instance.instance.id,
          sortOrder: 'votes',
        }),
        'user',
      );
    },
  ),

  networkJwtNonPublic: accessTierGatingCell(
    'admits network-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instance;

      const caller = await callers.networkJwt(setup.userEmail);

      let caught: unknown;
      try {
        await caller.decision.listSelectionCandidates({
          processInstanceId: instance.instance.id,
          sortOrder: 'votes',
        });
      } catch (err) {
        caught = err;
      }
      expect((caught as { cause?: { name?: string } })?.cause?.name).not.toBe(
        'UnauthorizedError',
      );
    },
  ),
});
