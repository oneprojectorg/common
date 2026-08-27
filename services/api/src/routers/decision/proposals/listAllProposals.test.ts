import { db } from '@op/db/client';
import {
  ProcessStatus,
  ProposalStatus,
  Visibility,
  decisionsVoteProposals,
  decisionsVoteSubmissions,
  proposalCategories,
  proposals,
  taxonomyTerms,
} from '@op/db/schema';
import { TRPCError } from '@trpc/server';
import { eq, inArray } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import {
  accessTierGatingCell,
  describeDecisionAccessTierGating,
  expectPassesAccessTierGate,
} from '../../../test/helpers/gating/decision';
import { schemaWithPipeline } from '../../../test/helpers/pipelineSchemas';
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

// Directly seeds a vote submission + join rows so ballot tests stay focused on
// the `votedByProfileId` filter rather than the voting business logic.
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

describe.concurrent('listAllProposals', () => {
  it('bypasses phase scoping to surface proposals not carried into the current phase', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      processSchema: schemaWithPipeline,
      instanceCount: 1,
      status: ProcessStatus.PUBLISHED,
    });
    const instanceId = setup.instance.instance.id;
    const { userEmail } = setup;
    const caller = await createAuthenticatedCaller(userEmail);

    // Submit 3 proposals; the submission→review pipeline is limit(2).
    for (let i = 1; i <= 3; i++) {
      await testData.createProposal({
        userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `Proposal ${i} ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      });
    }

    await testData.advancePhase({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'review',
    });

    const phaseScoped = await caller.decision.listProposals({
      processInstanceId: instanceId,
    });
    expect(phaseScoped.proposals).toHaveLength(2);

    const allValid = await caller.decision.listAllProposals({
      processInstanceId: instanceId,
    });
    expect(allValid.items).toHaveLength(3);
    expect(allValid.next).toBeNull();
  });

  it('filters by title search, matching the phase-scoped list', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instanceId = setup.instance.instance.id;
    const { userEmail } = setup;

    const [matching] = await Promise.all([
      testData.createProposal({
        userEmail,
        processInstanceId: instanceId,
        proposalData: { title: 'Riverside Bike Path' },
        status: ProposalStatus.SUBMITTED,
      }),
      testData.createProposal({
        userEmail,
        processInstanceId: instanceId,
        proposalData: { title: 'Downtown Mural' },
        status: ProposalStatus.SUBMITTED,
      }),
    ]);
    const caller = await createAuthenticatedCaller(userEmail);

    const result = await caller.decision.listAllProposals({
      processInstanceId: instanceId,
      search: 'bike',
    });
    expect(result.items.map((p) => p.id)).toEqual([matching.id]);

    // Same word-order independence as the phase-scoped list.
    const reversed = await caller.decision.listAllProposals({
      processInstanceId: instanceId,
      search: 'path riverside',
    });
    expect(reversed.items.map((p) => p.id)).toEqual([matching.id]);
  });

  it('includes REJECTED but excludes DUPLICATE proposals for non-admin viewers', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instance;

    const memberUser = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });

    const [submitted, approved, rejected, duplicate, selected] =
      await Promise.all([
        testData.createProposal({
          userEmail: memberUser.email,
          processInstanceId: instance.instance.id,
          proposalData: { title: `Submitted ${task.id}` },
          status: ProposalStatus.SUBMITTED,
        }),
        testData.createProposal({
          userEmail: memberUser.email,
          processInstanceId: instance.instance.id,
          proposalData: { title: `Approved ${task.id}` },
          status: ProposalStatus.APPROVED,
        }),
        testData.createProposal({
          userEmail: memberUser.email,
          processInstanceId: instance.instance.id,
          proposalData: { title: `Rejected ${task.id}` },
          status: ProposalStatus.REJECTED,
        }),
        testData.createProposal({
          userEmail: memberUser.email,
          processInstanceId: instance.instance.id,
          proposalData: { title: `Duplicate ${task.id}` },
          status: ProposalStatus.DUPLICATE,
        }),
        testData.createProposal({
          userEmail: memberUser.email,
          processInstanceId: instance.instance.id,
          proposalData: { title: `Selected ${task.id}` },
          status: ProposalStatus.SELECTED,
        }),
      ]);

    const memberCaller = await createAuthenticatedCaller(memberUser.email);
    const result = await memberCaller.decision.listAllProposals({
      processInstanceId: instance.instance.id,
    });

    const ids = result.items.map((p) => p.id);
    // Rejection is a pipeline rule, not a visibility one, so this listing
    // carries a rejected proposal the same way the phase-scoped list does.
    // A merged-away duplicate has no page of its own, so it stays out.
    expect(ids).toEqual(
      expect.arrayContaining([
        submitted.id,
        approved.id,
        selected.id,
        rejected.id,
      ]),
    );
    expect(ids).not.toContain(duplicate.id);
    expect(result.items).toHaveLength(4);
  });

  it('excludes DRAFT proposals from non-admin viewers', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instance;

    const memberUser = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });

    const [draft, submitted] = await Promise.all([
      testData.createProposal({
        userEmail: memberUser.email,
        processInstanceId: instance.instance.id,
        proposalData: { title: `Draft ${task.id}` },
        // default status is DRAFT
      }),
      testData.createProposal({
        userEmail: memberUser.email,
        processInstanceId: instance.instance.id,
        proposalData: { title: `Submitted ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      }),
    ]);

    const memberCaller = await createAuthenticatedCaller(memberUser.email);
    const result = await memberCaller.decision.listAllProposals({
      processInstanceId: instance.instance.id,
    });

    const ids = result.items.map((p) => p.id);
    expect(ids).toContain(submitted.id);
    expect(ids).not.toContain(draft.id);
  });

  it('excludes soft-deleted proposals from non-admin viewers', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instance;

    const memberUser = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });

    const [active, deleted] = await Promise.all([
      testData.createProposal({
        userEmail: memberUser.email,
        processInstanceId: instance.instance.id,
        proposalData: { title: `Active ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      }),
      testData.createProposal({
        userEmail: memberUser.email,
        processInstanceId: instance.instance.id,
        proposalData: { title: `Deleted ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      }),
    ]);

    await db
      .update(proposals)
      .set({ deletedAt: new Date().toISOString() })
      .where(eq(proposals.id, deleted.id));

    const memberCaller = await createAuthenticatedCaller(memberUser.email);
    const result = await memberCaller.decision.listAllProposals({
      processInstanceId: instance.instance.id,
    });

    const ids = result.items.map((p) => p.id);
    expect(ids).toContain(active.id);
    expect(ids).not.toContain(deleted.id);
    expect(result.items).toHaveLength(1);
  });

  it('hides HIDDEN proposals from non-admin viewers', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instance;
    const adminCaller = await createAuthenticatedCaller(setup.userEmail);

    const [visible, hidden] = await Promise.all([
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: `Visible ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      }),
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: `Hidden ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      }),
    ]);

    await adminCaller.decision.updateProposal({
      proposalId: hidden.id,
      data: { visibility: Visibility.HIDDEN },
    });

    const memberUser = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });
    const memberCaller = await createAuthenticatedCaller(memberUser.email);

    const memberResult = await memberCaller.decision.listAllProposals({
      processInstanceId: instance.instance.id,
    });
    expect(memberResult.items.map((p) => p.id)).toEqual([visible.id]);
  });

  it('shows HIDDEN and REJECTED proposals to admin viewers but still hides DRAFT, DUPLICATE, and soft-deleted', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instance;
    const adminCaller = await createAuthenticatedCaller(setup.userEmail);

    const [submitted, draft, rejected, duplicate, hidden, deleted] =
      await Promise.all([
        testData.createProposal({
          userEmail: setup.userEmail,
          processInstanceId: instance.instance.id,
          proposalData: { title: `Submitted ${task.id}` },
          status: ProposalStatus.SUBMITTED,
        }),
        testData.createProposal({
          userEmail: setup.userEmail,
          processInstanceId: instance.instance.id,
          proposalData: { title: `Draft ${task.id}` },
          // default status is DRAFT
        }),
        testData.createProposal({
          userEmail: setup.userEmail,
          processInstanceId: instance.instance.id,
          proposalData: { title: `Rejected ${task.id}` },
          status: ProposalStatus.REJECTED,
        }),
        testData.createProposal({
          userEmail: setup.userEmail,
          processInstanceId: instance.instance.id,
          proposalData: { title: `Duplicate ${task.id}` },
          status: ProposalStatus.DUPLICATE,
        }),
        testData.createProposal({
          userEmail: setup.userEmail,
          processInstanceId: instance.instance.id,
          proposalData: { title: `Hidden ${task.id}` },
          status: ProposalStatus.SUBMITTED,
        }),
        testData.createProposal({
          userEmail: setup.userEmail,
          processInstanceId: instance.instance.id,
          proposalData: { title: `Deleted ${task.id}` },
          status: ProposalStatus.SUBMITTED,
        }),
      ]);

    await adminCaller.decision.updateProposal({
      proposalId: hidden.id,
      data: { visibility: Visibility.HIDDEN },
    });

    await db
      .update(proposals)
      .set({ deletedAt: new Date().toISOString() })
      .where(eq(proposals.id, deleted.id));

    const result = await adminCaller.decision.listAllProposals({
      processInstanceId: instance.instance.id,
    });

    const ids = result.items.map((p) => p.id);
    expect(ids).toEqual(
      expect.arrayContaining([submitted.id, hidden.id, rejected.id]),
    );
    expect(ids).not.toContain(draft.id);
    expect(ids).not.toContain(duplicate.id);
    expect(ids).not.toContain(deleted.id);
    expect(result.items).toHaveLength(3);
  });

  it('paginates proposals filtered by category with a cursor', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instance;
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const termId = randomUUID();
    await db.insert(taxonomyTerms).values({
      id: termId,
      termUri: `category-${termId}`,
      label: `Category ${task.id}`,
    });
    // proposalCategories cascades on taxonomyTerms delete, so cleaning up the
    // term cleans up the join rows too.
    onTestFinished(async () => {
      await db.delete(taxonomyTerms).where(eq(taxonomyTerms.id, termId));
    });

    // Create 5 proposals in the category serially so each gets a distinct
    // createdAt — cursor pagination orders by createdAt without a tie-breaker.
    const inCategory: Array<{ id: string }> = [];
    for (let i = 0; i < 5; i++) {
      const proposal = await testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: `In-category ${i} ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      });
      await db
        .insert(proposalCategories)
        .values({ proposalId: proposal.id, taxonomyTermId: termId });
      inCategory.push(proposal);
    }

    // Two proposals outside the category — must never appear in results.
    const [outOne, outTwo] = await Promise.all([
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: `Out 1 ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      }),
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: `Out 2 ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      }),
    ]);

    const page1 = await caller.decision.listAllProposals({
      processInstanceId: instance.instance.id,
      categoryId: termId,
      limit: 2,
    });
    expect(page1.items).toHaveLength(2);
    expect(page1.next).not.toBeNull();
    // `total` is the full category-scoped count, not the page size, and stays
    // stable across pages so the listing header can show it on the first page.
    expect(page1.total).toBe(5);

    const page2 = await caller.decision.listAllProposals({
      processInstanceId: instance.instance.id,
      categoryId: termId,
      limit: 2,
      cursor: page1.next,
    });
    expect(page2.items).toHaveLength(2);
    expect(page2.next).not.toBeNull();
    expect(page2.total).toBe(5);

    const page3 = await caller.decision.listAllProposals({
      processInstanceId: instance.instance.id,
      categoryId: termId,
      limit: 2,
      cursor: page2.next,
    });
    expect(page3.items).toHaveLength(1);
    expect(page3.next).toBeNull();
    expect(page3.total).toBe(5);

    const returnedIds = [
      ...page1.items.map((p) => p.id),
      ...page2.items.map((p) => p.id),
      ...page3.items.map((p) => p.id),
    ];
    expect(new Set(returnedIds).size).toBe(5);
    for (const proposal of inCategory) {
      expect(returnedIds).toContain(proposal.id);
    }
    expect(returnedIds).not.toContain(outOne.id);
    expect(returnedIds).not.toContain(outTwo.id);
  });

  it('does not skip rows that share a boundary timestamp across pages', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instance;

    const created = [];
    for (let i = 1; i <= 5; i++) {
      created.push(
        await testData.createProposal({
          userEmail: setup.userEmail,
          processInstanceId: instance.instance.id,
          proposalData: { title: `Same-ts ${i} ${task.id}` },
          status: ProposalStatus.SUBMITTED,
        }),
      );
    }
    const allIds = created.map((p) => p.id);

    // Force every proposal to share one createdAt so pagination must rely on
    // the id tie-breaker; without it, page 2+ skips same-timestamp rows.
    await db
      .update(proposals)
      .set({ createdAt: '2020-01-01T00:00:00.000Z' })
      .where(inArray(proposals.id, allIds));

    const caller = await createAuthenticatedCaller(setup.userEmail);
    const seen: string[] = [];
    let cursor: string | null = null;
    // Bounded loop: at limit 2 over 5 rows it takes 3 pages; cap at 6 to avoid
    // hanging if pagination ever regressed into a loop.
    for (let page = 0; page < 6; page++) {
      const result = await caller.decision.listAllProposals({
        processInstanceId: instance.instance.id,
        limit: 2,
        cursor,
      });
      seen.push(...result.items.map((p) => p.id));
      expect(result.total).toBe(5);
      if (!result.next) {
        break;
      }
      cursor = result.next;
    }

    expect(seen.sort()).toEqual([...allIds].sort());
  });

  it('filters by submittedByProfileId with an accurate total', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instance;

    const [mine, other] = await Promise.all([
      testData.createMemberUser({
        organization: setup.organization,
        instanceProfileIds: [instance.profileId],
      }),
      testData.createMemberUser({
        organization: setup.organization,
        instanceProfileIds: [instance.profileId],
      }),
    ]);

    // 3 from `mine`, 2 from `other` — all submitted.
    const mineIds: string[] = [];
    for (let i = 1; i <= 3; i++) {
      const proposal = await testData.createProposal({
        userEmail: mine.email,
        processInstanceId: instance.instance.id,
        proposalData: { title: `Mine ${i} ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      });
      mineIds.push(proposal.id);
    }
    for (let i = 1; i <= 2; i++) {
      await testData.createProposal({
        userEmail: other.email,
        processInstanceId: instance.instance.id,
        proposalData: { title: `Other ${i} ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      });
    }

    const caller = await createAuthenticatedCaller(mine.email);
    const result = await caller.decision.listAllProposals({
      processInstanceId: instance.instance.id,
      submittedByProfileId: mine.profileId,
    });

    expect(result.total).toBe(3);
    expect(result.items.map((p) => p.id).sort()).toEqual([...mineIds].sort());
  });

  it('filters by votedByProfileId (own ballot) with an accurate total, paginated', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instance;

    const voter = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });

    // Five submitted proposals; the voter's ballot covers three of them.
    const created = [];
    for (let i = 1; i <= 5; i++) {
      created.push(
        await testData.createProposal({
          userEmail: setup.userEmail,
          processInstanceId: instance.instance.id,
          proposalData: { title: `Candidate ${i} ${task.id}` },
          status: ProposalStatus.SUBMITTED,
        }),
      );
    }
    const ballotIds = created.slice(0, 3).map((p) => p.id);
    await seedBallot({
      processInstanceId: instance.instance.id,
      voterProfileId: voter.profileId,
      proposalIds: ballotIds,
    });

    const caller = await createAuthenticatedCaller(voter.email);
    const page1 = await caller.decision.listAllProposals({
      processInstanceId: instance.instance.id,
      votedByProfileId: voter.profileId,
      limit: 2,
    });
    // total is the full ballot size regardless of the page limit.
    expect(page1.total).toBe(3);
    expect(page1.items).toHaveLength(2);
    expect(page1.next).not.toBeNull();

    const page2 = await caller.decision.listAllProposals({
      processInstanceId: instance.instance.id,
      votedByProfileId: voter.profileId,
      limit: 2,
      cursor: page1.next,
    });
    expect(page2.total).toBe(3);
    expect(page2.items).toHaveLength(1);
    expect(page2.next).toBeNull();

    const returnedIds = [
      ...page1.items.map((p) => p.id),
      ...page2.items.map((p) => p.id),
    ].sort();
    expect(returnedIds).toEqual([...ballotIds].sort());
  });

  it('rejects a caller requesting another member’s ballot', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instance = setup.instance;

    const [voter, snoop] = await Promise.all([
      testData.createMemberUser({
        organization: setup.organization,
        instanceProfileIds: [instance.profileId],
      }),
      testData.createMemberUser({
        organization: setup.organization,
        instanceProfileIds: [instance.profileId],
      }),
    ]);

    const snoopCaller = await createAuthenticatedCaller(snoop.email);
    await expect(
      snoopCaller.decision.listAllProposals({
        processInstanceId: instance.instance.id,
        votedByProfileId: voter.profileId,
      }),
    ).rejects.toThrowError(TRPCError);
  });
});

describeDecisionAccessTierGating('listAllProposals', {
  noJwtNonPublic: accessTierGatingCell(
    'admits no-JWT caller past the tier gate',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instance;

      const caller = await callers.noJwt();

      await expectPassesAccessTierGate(
        caller.decision.listAllProposals({
          processInstanceId: instance.instance.id,
        }),
      );
    },
  ),

  anonJwtNonPublic: accessTierGatingCell(
    'admits anon-JWT caller past the tier gate',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instance;

      const caller = await callers.anonJwt();

      await expectPassesAccessTierGate(
        caller.decision.listAllProposals({
          processInstanceId: instance.instance.id,
        }),
      );
    },
  ),

  userJwtNonPublic: accessTierGatingCell(
    'admits user-JWT caller past the tier gate',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instance;

      const caller = await callers.userJwt();

      await expectPassesAccessTierGate(
        caller.decision.listAllProposals({
          processInstanceId: instance.instance.id,
        }),
      );
    },
  ),

  networkJwtNonPublic: accessTierGatingCell(
    'admits network-JWT caller past the tier gate',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instance;

      const caller = await callers.networkJwt(setup.userEmail);

      await expectPassesAccessTierGate(
        caller.decision.listAllProposals({
          processInstanceId: instance.instance.id,
        }),
      );
    },
  ),
});
