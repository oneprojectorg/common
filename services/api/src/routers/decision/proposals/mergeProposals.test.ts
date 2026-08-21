import { MERGE_NOTE_MAX_LENGTH } from '@op/common/client';
import { db } from '@op/db/client';
import {
  ProposalRelationshipType,
  ProposalStatus,
  Visibility,
  proposalRelationships,
  proposals,
} from '@op/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import {
  accessTierGatingCell,
  describeDecisionAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../../test/helpers/gating/decision';
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

/**
 * Two proposals in one instance, both SHORTLISTED rather than SUBMITTED so the
 * assertions can show status is never touched.
 */
async function createMergeableProposals(testData: TestDecisionsDataManager) {
  const setup = await testData.createDecisionSetup({
    instanceCount: 1,
    grantAccess: true,
  });
  const instanceId = setup.instance.instance.id;

  const [source, target, caller] = await Promise.all([
    testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instanceId,
      proposalData: { title: 'Source Proposal', description: 'Merges away' },
      status: ProposalStatus.SHORTLISTED,
    }),
    testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instanceId,
      proposalData: { title: 'Target Proposal', description: 'Survives' },
      status: ProposalStatus.SHORTLISTED,
    }),
    createAuthenticatedCaller(setup.userEmail),
  ]);

  return { setup, instanceId, source, target, caller };
}

async function readStatus(proposalId: string) {
  const row = await db.query.proposals.findFirst({
    where: { id: proposalId },
    columns: { status: true },
  });
  return row?.status;
}

describe.concurrent('mergeProposals', () => {
  it('records the edge and leaves both statuses alone', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, source, target, caller } =
      await createMergeableProposals(testData);

    await caller.decision.mergeProposals({
      sourceProposalId: source.id,
      targetProposalId: target.id,
    });

    // Supersession is not a status, so the source keeps the one it had.
    expect(await readStatus(source.id)).toBe(ProposalStatus.SHORTLISTED);
    // The target is untouched — merging is a link, not a transfer.
    expect(await readStatus(target.id)).toBe(ProposalStatus.SHORTLISTED);

    const [edge] = await db
      .select()
      .from(proposalRelationships)
      .where(eq(proposalRelationships.sourceProposalId, source.id));

    expect(edge).toMatchObject({
      targetProposalId: target.id,
      relationshipType: 'merged',
      // The exclusion predicate correlates on this, so it must be set.
      processInstanceId: instanceId,
    });
  });

  it('stores the note the admin wrote for the author', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { source, target, caller } = await createMergeableProposals(testData);

    await caller.decision.mergeProposals({
      sourceProposalId: source.id,
      targetProposalId: target.id,
      note: '  These describe the same garden plot.  ',
    });

    const [edge] = await db
      .select()
      .from(proposalRelationships)
      .where(eq(proposalRelationships.sourceProposalId, source.id));

    expect(edge?.note).toBe('These describe the same garden plot.');
  });

  it('stores NULL rather than an empty note for a blank textarea', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { source, target, caller } = await createMergeableProposals(testData);

    await caller.decision.mergeProposals({
      sourceProposalId: source.id,
      targetProposalId: target.id,
      note: '   ',
    });

    const [edge] = await db
      .select()
      .from(proposalRelationships)
      .where(eq(proposalRelationships.sourceProposalId, source.id));

    // Distinguishable from an empty note: consumers ask whether a reason exists.
    expect(edge?.note).toBeNull();
  });

  it('rejects a note past the length cap', async ({ task, onTestFinished }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { source, target, caller } = await createMergeableProposals(testData);

    await expect(
      caller.decision.mergeProposals({
        sourceProposalId: source.id,
        targetProposalId: target.id,
        note: 'x'.repeat(MERGE_NOTE_MAX_LENGTH + 1),
      }),
    ).rejects.toThrow();
  });

  it('lets the database reject a second live merged edge', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, setup, source, target, caller } =
      await createMergeableProposals(testData);

    const third = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instanceId,
      proposalData: { title: 'Third Proposal', description: 'Second target' },
      status: ProposalStatus.SHORTLISTED,
    });

    await caller.decision.mergeProposals({
      sourceProposalId: source.id,
      targetProposalId: target.id,
    });

    // Must hold without the service, which is what lets merge skip a guard.
    await expect(
      db.insert(proposalRelationships).values({
        processInstanceId: instanceId,
        sourceProposalId: source.id,
        targetProposalId: third.id,
        relationshipType: ProposalRelationshipType.MERGED,
      }),
    ).rejects.toThrow();
  });

  it('hides the merged proposal from listProposals', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, source, target, caller } =
      await createMergeableProposals(testData);

    const before = await caller.decision.listProposals({
      processInstanceId: instanceId,
    });
    expect(before.proposals.map((p) => p.id)).toEqual(
      expect.arrayContaining([source.id, target.id]),
    );

    await caller.decision.mergeProposals({
      sourceProposalId: source.id,
      targetProposalId: target.id,
    });

    const after = await caller.decision.listProposals({
      processInstanceId: instanceId,
    });
    const ids = after.proposals.map((p) => p.id);
    expect(ids).not.toContain(source.id);
    expect(ids).toContain(target.id);
    expect(after.total).toBe(before.total - 1);
  });

  it('stays hidden even when the caller filters for the status it kept', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, source, target, caller } =
      await createMergeableProposals(testData);

    await caller.decision.mergeProposals({
      sourceProposalId: source.id,
      targetProposalId: target.id,
    });

    // Asking for the status it kept is how a caller would reach around the
    // filter if it were bypassable.
    const result = await caller.decision.listProposals({
      processInstanceId: instanceId,
      status: ProposalStatus.SHORTLISTED,
    });

    expect(result.proposals.map((proposal) => proposal.id)).toEqual([
      target.id,
    ]);
  });

  it('rejects merging a proposal into itself', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { source, caller } = await createMergeableProposals(testData);

    await expect(
      caller.decision.mergeProposals({
        sourceProposalId: source.id,
        targetProposalId: source.id,
      }),
    ).rejects.toThrow(/cannot be merged into itself/i);
  });

  it('rejects merging a proposal that is already merged', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, setup, source, target, caller } =
      await createMergeableProposals(testData);

    const third = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instanceId,
      proposalData: { title: 'Third Proposal', description: 'Another target' },
      status: ProposalStatus.SHORTLISTED,
    });

    await caller.decision.mergeProposals({
      sourceProposalId: source.id,
      targetProposalId: target.id,
    });

    await expect(
      caller.decision.mergeProposals({
        sourceProposalId: source.id,
        targetProposalId: third.id,
      }),
    ).rejects.toThrow(/already been merged/i);
  });

  it('rejects merging into a proposal that is itself merged', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, setup, source, target, caller } =
      await createMergeableProposals(testData);

    const third = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instanceId,
      proposalData: { title: 'Third Proposal', description: 'Chained' },
      status: ProposalStatus.SHORTLISTED,
    });

    await caller.decision.mergeProposals({
      sourceProposalId: source.id,
      targetProposalId: target.id,
    });

    await expect(
      caller.decision.mergeProposals({
        sourceProposalId: third.id,
        targetProposalId: source.id,
      }),
    ).rejects.toThrow(/itself been merged/i);
  });

  it('merges a proposal that has proposals merged into it, forming a chain', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, setup, source, target, caller } =
      await createMergeableProposals(testData);

    const third = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instanceId,
      proposalData: { title: 'Third Proposal', description: 'Final survivor' },
      status: ProposalStatus.SHORTLISTED,
    });

    await caller.decision.mergeProposals({
      sourceProposalId: source.id,
      targetProposalId: target.id,
    });
    await caller.decision.mergeProposals({
      sourceProposalId: target.id,
      targetProposalId: third.id,
    });

    // Every proposal with an outgoing edge leaves the listing, so a chain
    // resolves to its one live end without anything traversing it.
    const result = await caller.decision.listProposals({
      processInstanceId: instanceId,
    });

    expect(result.proposals.map((proposal) => proposal.id)).toEqual([third.id]);
  });

  it('rejects merging a draft proposal', async ({ task, onTestFinished }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, setup, target, caller } =
      await createMergeableProposals(testData);

    const draft = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instanceId,
      proposalData: { title: 'Draft Proposal', description: 'Not submitted' },
    });

    await expect(
      caller.decision.mergeProposals({
        sourceProposalId: draft.id,
        targetProposalId: target.id,
      }),
    ).rejects.toThrow(/draft proposal cannot be merged/i);
  });

  it('rejects merging across decisions', async ({ task, onTestFinished }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { source, caller } = await createMergeableProposals(testData);

    const otherSetup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const otherProposal = await testData.createProposal({
      userEmail: otherSetup.userEmail,
      processInstanceId: otherSetup.instance.instance.id,
      proposalData: { title: 'Elsewhere', description: 'Different decision' },
      status: ProposalStatus.SHORTLISTED,
    });

    await expect(
      caller.decision.mergeProposals({
        sourceProposalId: source.id,
        targetProposalId: otherProposal.id,
      }),
    ).rejects.toThrow(/same decision/i);
  });

  it('rejects a non-admin member of the decision', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, source, target } = await createMergeableProposals(testData);

    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [setup.instance.profileId],
    });
    const memberCaller = await createAuthenticatedCaller(member.email);

    await expect(
      memberCaller.decision.mergeProposals({
        sourceProposalId: source.id,
        targetProposalId: target.id,
      }),
    ).rejects.toThrow();

    // The source is untouched — a failed authz check must not partially apply.
    expect(await readStatus(source.id)).toBe(ProposalStatus.SHORTLISTED);
  });
});

describe.concurrent('unmergeProposal', () => {
  it('returns the proposal to the listing with its original status and drops the edge', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, source, target, caller } =
      await createMergeableProposals(testData);

    await caller.decision.mergeProposals({
      sourceProposalId: source.id,
      targetProposalId: target.id,
    });
    await caller.decision.unmergeProposal({
      sourceProposalId: source.id,
    });

    // The status it held before the merge; no re-triage after an unmerge.
    expect(await readStatus(source.id)).toBe(ProposalStatus.SHORTLISTED);

    const liveEdges = await db
      .select()
      .from(proposalRelationships)
      .where(
        and(
          eq(proposalRelationships.sourceProposalId, source.id),
          isNull(proposalRelationships.deletedAt),
        ),
      );
    expect(liveEdges).toHaveLength(0);

    const listed = await caller.decision.listProposals({
      processInstanceId: instanceId,
    });
    expect(listed.proposals.map((p) => p.id)).toContain(source.id);
  });

  it('allows re-merging the same pair after an unmerge', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { source, target, caller } = await createMergeableProposals(testData);

    await caller.decision.mergeProposals({
      sourceProposalId: source.id,
      targetProposalId: target.id,
    });
    await caller.decision.unmergeProposal({
      sourceProposalId: source.id,
    });
    await caller.decision.mergeProposals({
      sourceProposalId: source.id,
      targetProposalId: target.id,
    });

    // Both unique indexes are partial, so the soft-deleted edge doesn't block.
    const liveEdges = await db
      .select()
      .from(proposalRelationships)
      .where(
        and(
          eq(proposalRelationships.sourceProposalId, source.id),
          isNull(proposalRelationships.deletedAt),
        ),
      );

    expect(liveEdges).toHaveLength(1);
    expect(liveEdges[0]).toMatchObject({ targetProposalId: target.id });
  });

  it('un-hides the source when the target proposal is deleted', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, source, target, caller } =
      await createMergeableProposals(testData);

    await caller.decision.mergeProposals({
      sourceProposalId: source.id,
      targetProposalId: target.id,
    });

    // Deleting the survivor cascades the edge away, so the source stops being
    // superseded by something that no longer exists and returns to the listing
    // on its own — no unmerge call needed.
    await db.delete(proposals).where(eq(proposals.id, target.id));

    const result = await caller.decision.listProposals({
      processInstanceId: instanceId,
    });

    expect(result.proposals.map((proposal) => proposal.id)).toEqual([
      source.id,
    ]);
    expect(await readStatus(source.id)).toBe(ProposalStatus.SHORTLISTED);
  });

  it('rejects unmerging a proposal that was never merged', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { source, caller } = await createMergeableProposals(testData);

    await expect(
      caller.decision.unmergeProposal({ sourceProposalId: source.id }),
    ).rejects.toThrow();
  });

  it('rejects a non-admin member of the decision', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, setup, source, target, caller } =
      await createMergeableProposals(testData);

    await caller.decision.mergeProposals({
      sourceProposalId: source.id,
      targetProposalId: target.id,
    });

    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [setup.instance.profileId],
    });
    const memberCaller = await createAuthenticatedCaller(member.email);

    await expect(
      memberCaller.decision.unmergeProposal({ sourceProposalId: source.id }),
    ).rejects.toThrow();

    // Undoing a merge is as admin-only as making one: the source stays hidden.
    const result = await caller.decision.listProposals({
      processInstanceId: instanceId,
    });

    expect(result.proposals.map((proposal) => proposal.id)).toEqual([
      target.id,
    ]);
  });
});

describe.concurrent('listProposalRelationships', () => {
  it('lists what was merged into a proposal when pinning the target', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { source, target, caller } = await createMergeableProposals(testData);

    await caller.decision.mergeProposals({
      sourceProposalId: source.id,
      targetProposalId: target.id,
    });

    const result = await caller.decision.listProposalRelationships({
      targetProposalId: target.id,
    });

    expect(result.relationships).toHaveLength(1);
    // The far end is the merged-away proposal, not the one that was pinned.
    expect(result.relationships[0]).toMatchObject({
      relationshipType: 'merged',
      proposal: {
        id: source.id,
        status: ProposalStatus.SHORTLISTED,
        profile: { id: source.profileId },
      },
    });
  });

  it('lists what a proposal was merged into when pinning the source', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { source, target, caller } = await createMergeableProposals(testData);

    await caller.decision.mergeProposals({
      sourceProposalId: source.id,
      targetProposalId: target.id,
    });

    const result = await caller.decision.listProposalRelationships({
      sourceProposalId: source.id,
    });

    expect(result.relationships).toHaveLength(1);
    expect(result.relationships[0]).toMatchObject({
      proposal: { id: target.id, profile: { id: target.profileId } },
    });
  });

  it('rejects pinning both ends or neither', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { source, target, caller } = await createMergeableProposals(testData);

    await expect(
      caller.decision.listProposalRelationships({
        sourceProposalId: source.id,
        targetProposalId: target.id,
      }),
    ).rejects.toThrow();

    await expect(
      caller.decision.listProposalRelationships({}),
    ).rejects.toThrow();
  });

  it('drops the edge once unmerged', async ({ task, onTestFinished }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { source, target, caller } = await createMergeableProposals(testData);

    await caller.decision.mergeProposals({
      sourceProposalId: source.id,
      targetProposalId: target.id,
    });
    await caller.decision.unmergeProposal({
      sourceProposalId: source.id,
    });

    const result = await caller.decision.listProposalRelationships({
      targetProposalId: target.id,
    });
    expect(result.relationships).toHaveLength(0);
  });

  it('is readable by a non-admin member of the decision', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, source, target, caller } =
      await createMergeableProposals(testData);

    await caller.decision.mergeProposals({
      sourceProposalId: source.id,
      targetProposalId: target.id,
    });

    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [setup.instance.profileId],
    });
    const memberCaller = await createAuthenticatedCaller(member.email);

    // Read access is enough, even though the merged proposal is hidden from
    // this member's listings.
    const result = await memberCaller.decision.listProposalRelationships({
      targetProposalId: target.id,
    });

    expect(result.relationships).toHaveLength(1);
    expect(result.relationships[0]).toMatchObject({
      proposal: { id: source.id },
    });
  });

  it('omits a linked proposal the caller could not open', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, source, target, caller } =
      await createMergeableProposals(testData);

    await caller.decision.mergeProposals({
      sourceProposalId: source.id,
      targetProposalId: target.id,
    });

    // Read access to the decision doesn't imply read access to every proposal
    // in it. `getProposal` would 404 a hidden proposal for this member, and the
    // profile name exposed by the list is the proposal's title.
    await db
      .update(proposals)
      .set({ visibility: Visibility.HIDDEN })
      .where(eq(proposals.id, source.id));

    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [setup.instance.profileId],
    });
    const memberCaller = await createAuthenticatedCaller(member.email);

    const result = await memberCaller.decision.listProposalRelationships({
      targetProposalId: target.id,
    });

    expect(result.relationships).toEqual([]);
  });

  it('hides relationships on a pinned proposal the caller could not open', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, source, target, caller } =
      await createMergeableProposals(testData);

    await caller.decision.mergeProposals({
      sourceProposalId: source.id,
      targetProposalId: target.id,
    });

    // Restricting the *pinned* end, not the far end. Knowing its id shouldn't
    // reveal that it has a merge relationship, or what is linked to it.
    await db
      .update(proposals)
      .set({ visibility: Visibility.HIDDEN })
      .where(eq(proposals.id, target.id));

    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [setup.instance.profileId],
    });
    const memberCaller = await createAuthenticatedCaller(member.email);

    await expect(
      memberCaller.decision.listProposalRelationships({
        targetProposalId: target.id,
      }),
    ).rejects.toMatchObject({ cause: { name: 'NotFoundError' } });
  });

  it('rejects a caller with no access to the decision', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { target } = await createMergeableProposals(testData);

    // Read access is still required; it just no longer has to be admin.
    const outsiderSetup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const outsiderCaller = await createAuthenticatedCaller(
      outsiderSetup.userEmail,
    );

    await expect(
      outsiderCaller.decision.listProposalRelationships({
        targetProposalId: target.id,
      }),
    ).rejects.toThrow();
  });
});

const UNKNOWN_PROPOSAL_ID = '00000000-0000-0000-0000-000000000000';

describeDecisionAccessTierGating('decision.mergeProposals', {
  noJwtNonPublic: accessTierGatingCell(
    'rejects no-JWT caller',
    async ({ callers }) => {
      const caller = await callers.noJwt();
      await expectFailsAccessTierGate(
        caller.decision.mergeProposals({
          sourceProposalId: UNKNOWN_PROPOSAL_ID,
          targetProposalId: '00000000-0000-0000-0000-000000000001',
        }),
        'none',
      );
    },
  ),

  anonJwtNonPublic: accessTierGatingCell(
    'rejects anon-JWT caller',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expectFailsAccessTierGate(
        caller.decision.mergeProposals({
          sourceProposalId: UNKNOWN_PROPOSAL_ID,
          targetProposalId: '00000000-0000-0000-0000-000000000001',
        }),
        'anon',
      );
    },
  ),

  userJwtNonPublic: accessTierGatingCell(
    'rejects out-of-network user-JWT caller',
    async ({ callers }) => {
      const caller = await callers.userJwt();
      await expectFailsAccessTierGate(
        caller.decision.mergeProposals({
          sourceProposalId: UNKNOWN_PROPOSAL_ID,
          targetProposalId: '00000000-0000-0000-0000-000000000001',
        }),
        'user',
      );
    },
  ),

  networkJwtNonPublic: accessTierGatingCell(
    'admits network-JWT caller past the tier gate',
    async ({ callers }) => {
      const caller = await callers.networkJwt();
      await expectPassesAccessTierGate(
        caller.decision.mergeProposals({
          sourceProposalId: UNKNOWN_PROPOSAL_ID,
          targetProposalId: '00000000-0000-0000-0000-000000000001',
        }),
      );
    },
  ),
});

describeDecisionAccessTierGating('decision.unmergeProposal', {
  noJwtNonPublic: accessTierGatingCell(
    'rejects no-JWT caller',
    async ({ callers }) => {
      const caller = await callers.noJwt();
      await expectFailsAccessTierGate(
        caller.decision.unmergeProposal({
          sourceProposalId: UNKNOWN_PROPOSAL_ID,
        }),
        'none',
      );
    },
  ),

  anonJwtNonPublic: accessTierGatingCell(
    'rejects anon-JWT caller',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expectFailsAccessTierGate(
        caller.decision.unmergeProposal({
          sourceProposalId: UNKNOWN_PROPOSAL_ID,
        }),
        'anon',
      );
    },
  ),

  userJwtNonPublic: accessTierGatingCell(
    'rejects out-of-network user-JWT caller',
    async ({ callers }) => {
      const caller = await callers.userJwt();
      await expectFailsAccessTierGate(
        caller.decision.unmergeProposal({
          sourceProposalId: UNKNOWN_PROPOSAL_ID,
        }),
        'user',
      );
    },
  ),

  networkJwtNonPublic: accessTierGatingCell(
    'admits network-JWT caller past the tier gate',
    async ({ callers }) => {
      const caller = await callers.networkJwt();
      await expectPassesAccessTierGate(
        caller.decision.unmergeProposal({
          sourceProposalId: UNKNOWN_PROPOSAL_ID,
        }),
      );
    },
  ),
});

// `openProcedure`, matching `getProposal`: every tier clears the middleware
// and authorization is the service layer's job, so no cell rejects here. The
// real gate is covered by the read-access tests above.
describeDecisionAccessTierGating('decision.listProposalRelationships', {
  noJwtNonPublic: accessTierGatingCell(
    'admits no-JWT caller past the tier gate',
    async ({ callers }) => {
      const caller = await callers.noJwt();
      await expectPassesAccessTierGate(
        caller.decision.listProposalRelationships({
          targetProposalId: UNKNOWN_PROPOSAL_ID,
        }),
      );
    },
  ),

  anonJwtNonPublic: accessTierGatingCell(
    'admits anon-JWT caller past the tier gate',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expectPassesAccessTierGate(
        caller.decision.listProposalRelationships({
          targetProposalId: UNKNOWN_PROPOSAL_ID,
        }),
      );
    },
  ),

  userJwtNonPublic: accessTierGatingCell(
    'admits out-of-network user-JWT caller past the tier gate',
    async ({ callers }) => {
      const caller = await callers.userJwt();
      await expectPassesAccessTierGate(
        caller.decision.listProposalRelationships({
          targetProposalId: UNKNOWN_PROPOSAL_ID,
        }),
      );
    },
  ),

  networkJwtNonPublic: accessTierGatingCell(
    'admits network-JWT caller past the tier gate',
    async ({ callers }) => {
      const caller = await callers.networkJwt();
      await expectPassesAccessTierGate(
        caller.decision.listProposalRelationships({
          targetProposalId: UNKNOWN_PROPOSAL_ID,
        }),
      );
    },
  ),
});
