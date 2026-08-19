import {
  type DecisionInstanceData,
  type ReviewsScope,
  addCategoryReviewer,
  advancePhase,
  createDecisionRole,
  generateReviewAssignments,
  reconcileReviewAssignments,
  removeCategoryReviewer,
  updateProposal,
} from '@op/common';
import { and, db, eq, inArray } from '@op/db/client';
import {
  ProcessStatus,
  ProposalReviewAssignmentStatus,
  ProposalStatus,
  categoryReviewers,
  proposalCategories,
  proposalReviewAssignments,
  proposalReviews,
  taxonomies,
  taxonomyTerms,
} from '@op/db/schema';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';

/** The schema shape createDecisionSetup accepts (encoder-inferred, not exported). */
type TestProcessSchema = NonNullable<
  NonNullable<
    Parameters<TestDecisionsDataManager['createDecisionSetup']>[0]
  >['processSchema']
>;

/**
 * submission → review → results, review phase carrying a configurable
 * `reviews.scope`. The review phase also accepts submissions so mid-phase
 * proposal writes are representable.
 */
function schemaWithScope(scope: ReviewsScope): TestProcessSchema {
  return {
    id: `reconcile-by-category-schema-${scope}`,
    version: '1.0.0',
    name: 'Reconcile By Category Schema',
    description: 'Schema with a by-category review phase for reconcile testing',
    config: {
      reviewsPolicy: 'full_coverage',
    },
    phases: [
      {
        id: 'submission',
        name: 'Submission',
        description: 'Submit proposals',
        rules: {
          proposals: { submit: true },
          advancement: { method: 'manual' },
        },
        // Pass-all: every submitted proposal advances into review.
        selectionPipeline: { version: '1.0.0', blocks: [] },
      },
      {
        id: 'review',
        name: 'Review',
        description: 'Review proposals',
        rules: {
          proposals: { review: true, submit: true },
          reviews: { submit: true, scope },
          advancement: { method: 'manual' },
        },
      },
      {
        id: 'results',
        name: 'Results',
        description: 'Final results',
        rules: {
          proposals: { submit: false },
          advancement: { method: 'manual' },
        },
      },
    ],
  } satisfies TestProcessSchema;
}

async function createReviewInstance(
  testData: TestDecisionsDataManager,
  scope: ReviewsScope,
  status: ProcessStatus = ProcessStatus.PUBLISHED,
) {
  const setup = await testData.createDecisionSetup({
    instanceCount: 1,
    processSchema: schemaWithScope(scope),
    status,
  });

  return { setup, instance: setup.instance };
}

/** A "Reviewer" role on the given decision profile with only the REVIEW bit. */
async function createReviewerRole(instanceProfileId: string) {
  return createDecisionRole({
    name: 'Reviewer',
    profileId: instanceProfileId,
    permissions: {
      decisions: {
        type: 'decision',
        value: {
          create: false,
          read: true,
          update: false,
          delete: false,
          admin: false,
          inviteMembers: false,
          review: true,
          submitProposals: false,
          vote: false,
        },
      },
    },
  });
}

/**
 * Appends uniquely-labeled terms to the shared "proposal" taxonomy. Labels are
 * per-call unique so concurrent tests don't collide on (taxonomyId, termUri).
 */
async function seedTerms(
  count: number,
  onTestFinished: (fn: () => void | Promise<void>) => void,
) {
  const taxonomyId = randomUUID();
  const [inserted] = await db
    .insert(taxonomies)
    .values({ id: taxonomyId, name: 'proposal' })
    .onConflictDoNothing({ target: taxonomies.name })
    .returning({ id: taxonomies.id });

  let resolvedTaxonomyId: string;
  if (inserted) {
    resolvedTaxonomyId = inserted.id;
  } else {
    const [existing] = await db
      .select({ id: taxonomies.id })
      .from(taxonomies)
      .where(eq(taxonomies.name, 'proposal'));
    if (!existing) {
      throw new Error('proposal taxonomy not found after conflict');
    }
    resolvedTaxonomyId = existing.id;
  }

  const suffix = randomUUID().slice(0, 8);
  const termRecords = Array.from({ length: count }, (_, i) => ({
    id: randomUUID(),
    taxonomyId: resolvedTaxonomyId,
    termUri: `district-${suffix}-${i}`,
    label: `District ${suffix} ${i}`,
  }));

  await db.insert(taxonomyTerms).values(termRecords);

  onTestFinished(async () => {
    await db.delete(taxonomyTerms).where(
      inArray(
        taxonomyTerms.id,
        termRecords.map((t) => t.id),
      ),
    );
  });

  return termRecords;
}

/** Tags a proposal with a taxonomy term (a submission category). */
async function tagProposal(proposalId: string, taxonomyTermId: string) {
  await db
    .insert(proposalCategories)
    .values({ proposalId, taxonomyTermId })
    .onConflictDoNothing();
}

/** Directly inserts a scope row (system context — no admin caller needed). */
async function scopeReviewer({
  processInstanceId,
  taxonomyTermId,
  reviewerProfileId,
  phaseId,
}: {
  processInstanceId: string;
  taxonomyTermId: string;
  reviewerProfileId: string;
  phaseId?: string | null;
}) {
  await db
    .insert(categoryReviewers)
    .values({
      processInstanceId,
      taxonomyTermId,
      reviewerProfileId,
      phaseId: phaseId ?? null,
    })
    .onConflictDoNothing();
}

async function advanceToReviewPhase(instanceId: string) {
  const dbInstance = await db.query.processInstances.findFirst({
    where: { id: instanceId },
  });
  if (!dbInstance) {
    throw new Error('Instance not found');
  }

  const result = await db.transaction(async (tx) =>
    advancePhase({
      db: tx,
      instance: {
        id: dbInstance.id,
        instanceData: dbInstance.instanceData as DecisionInstanceData,
      },
      fromPhaseId: 'submission',
      toPhaseId: 'review',
      triggeredByProfileId: null,
    }),
  );

  if (result.conflict) {
    throw new Error('Unexpected conflict during advance');
  }

  return result;
}

/** Advance into review and materialize the by-category assignment baseline. */
async function generateBaseline(instanceId: string) {
  const advanceResult = await advanceToReviewPhase(instanceId);
  await generateReviewAssignments({
    instanceId,
    phaseId: 'review',
    selectedProposalIds: advanceResult.selectedProposalIds,
    transitionHistoryId: advanceResult.transitionHistoryId,
  });
}

async function getAssignments(instanceId: string) {
  return db
    .select()
    .from(proposalReviewAssignments)
    .where(eq(proposalReviewAssignments.processInstanceId, instanceId));
}

/** Map proposalId → set of reviewerProfileIds actually assigned. */
function reviewersByProposal(
  assignments: Array<{ proposalId: string; reviewerProfileId: string }>,
) {
  const map = new Map<string, Set<string>>();
  for (const a of assignments) {
    const bucket = map.get(a.proposalId) ?? new Set<string>();
    bucket.add(a.reviewerProfileId);
    map.set(a.proposalId, bucket);
  }
  return map;
}

describe.concurrent('reconcileReviewAssignments — 6b-add', () => {
  it('adds a reviewer to a category mid-phase and backfills that category’s in-phase proposals (add-only)', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance } = await createReviewInstance(
      testData,
      'by_category',
    );
    const reviewerRole = await createReviewerRole(instance.profileId);
    const [termA, termB] = await seedTerms(2, onTestFinished);

    const reviewer = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
      roleIds: { [instance.profileId]: reviewerRole.id },
    });

    const [pA, pB] = await Promise.all([
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'Cat A proposal' },
        status: ProposalStatus.SUBMITTED,
      }),
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'Cat B proposal' },
        status: ProposalStatus.SUBMITTED,
      }),
    ]);

    await tagProposal(pA!.id, termA!.id);
    await tagProposal(pB!.id, termB!.id);

    // No scope rows for `reviewer` at generation time → they get no assignments.
    await generateBaseline(instance.instance.id);
    const baseline = await getAssignments(instance.instance.id);
    expect(
      baseline.filter((a) => a.reviewerProfileId === reviewer.profileId),
    ).toHaveLength(0);

    // Admin adds `reviewer` to category A mid-phase — this fires the reconciler.
    await addCategoryReviewer({
      processInstanceId: instance.instance.id,
      taxonomyTermId: termA!.id,
      reviewerProfileId: reviewer.profileId,
      user: setup.user,
    });

    const assignments = await getAssignments(instance.instance.id);
    const reviewerAssignments = assignments.filter(
      (a) => a.reviewerProfileId === reviewer.profileId,
    );

    // Exactly one new row — the cat-A proposal only. Cat-B is out of their scope.
    expect(reviewerAssignments).toHaveLength(1);
    expect(reviewerAssignments[0]?.proposalId).toBe(pA!.id);
    // Add-only: the baseline rows are untouched.
    expect(assignments).toHaveLength(baseline.length + 1);
  });

  it('excludes a scoped reviewer who lacks the REVIEW role (fail-closed intersection)', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance } = await createReviewInstance(
      testData,
      'by_category',
    );
    const [termA] = await seedTerms(1, onTestFinished);

    // nonReviewer has instance access but no REVIEW role.
    const nonReviewer = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });

    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Cat A proposal' },
      status: ProposalStatus.SUBMITTED,
    });
    await tagProposal(proposal.id, termA!.id);

    await generateBaseline(instance.instance.id);

    await addCategoryReviewer({
      processInstanceId: instance.instance.id,
      taxonomyTermId: termA!.id,
      reviewerProfileId: nonReviewer.profileId,
      user: setup.user,
    });

    const assignments = await getAssignments(instance.instance.id);
    // A scope row alone grants nothing — the eligibility intersection is empty.
    expect(
      assignments.filter((a) => a.reviewerProfileId === nonReviewer.profileId),
    ).toHaveLength(0);
  });

  it('never adds a self-review assignment when the author is scoped to their own proposal’s category', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance } = await createReviewInstance(
      testData,
      'by_category',
    );
    const reviewerRole = await createReviewerRole(instance.profileId);
    const [termA] = await seedTerms(1, onTestFinished);

    const author = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
      roleIds: { [instance.profileId]: reviewerRole.id },
    });

    const ownProposal = await testData.createProposal({
      userEmail: author.email,
      processInstanceId: instance.instance.id,
      proposalData: { title: "Author's own proposal" },
      status: ProposalStatus.SUBMITTED,
    });
    await tagProposal(ownProposal.id, termA!.id);

    await generateBaseline(instance.instance.id);

    // Author (a reviewer) is added to their own proposal's category.
    await addCategoryReviewer({
      processInstanceId: instance.instance.id,
      taxonomyTermId: termA!.id,
      reviewerProfileId: author.profileId,
      user: setup.user,
    });

    const assignments = await getAssignments(instance.instance.id);
    // Self-review stays excluded — no assignment of the author to their own work.
    expect(
      assignments.filter(
        (a) =>
          a.reviewerProfileId === author.profileId &&
          a.proposalId === ownProposal.id,
      ),
    ).toHaveLength(0);
  });
});

describe.concurrent('reconcileReviewAssignments — 6b-prune', () => {
  it('removing a reviewer from a category prunes their pending assignments but keeps non-pending ones (and their reviews)', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance } = await createReviewInstance(
      testData,
      'by_category',
    );
    const reviewerRole = await createReviewerRole(instance.profileId);
    const [termA] = await seedTerms(1, onTestFinished);

    const reviewer = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
      roleIds: { [instance.profileId]: reviewerRole.id },
    });

    // Two cat-A proposals: one stays pending (pruned), one goes in_progress (kept).
    const [pPending, pInProgress] = await Promise.all([
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'Pending proposal' },
        status: ProposalStatus.SUBMITTED,
      }),
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'In-progress proposal' },
        status: ProposalStatus.SUBMITTED,
      }),
    ]);

    await tagProposal(pPending!.id, termA!.id);
    await tagProposal(pInProgress!.id, termA!.id);
    await scopeReviewer({
      processInstanceId: instance.instance.id,
      taxonomyTermId: termA!.id,
      reviewerProfileId: reviewer.profileId,
    });

    await generateBaseline(instance.instance.id);

    // Move the in-progress proposal's assignment past `pending` and attach a
    // rubric review row — the cascade that makes a non-pending delete destructive.
    const [inProgressAssignment] = await db
      .update(proposalReviewAssignments)
      .set({ status: ProposalReviewAssignmentStatus.IN_PROGRESS })
      .where(
        and(
          eq(proposalReviewAssignments.processInstanceId, instance.instance.id),
          eq(proposalReviewAssignments.proposalId, pInProgress!.id),
          eq(proposalReviewAssignments.reviewerProfileId, reviewer.profileId),
        ),
      )
      .returning({ id: proposalReviewAssignments.id });

    await db.insert(proposalReviews).values({
      assignmentId: inProgressAssignment!.id,
      reviewData: { score: 5 },
    });

    // Admin removes the reviewer from category A — fires the prune reconcile.
    const result = await removeCategoryReviewer({
      processInstanceId: instance.instance.id,
      taxonomyTermId: termA!.id,
      reviewerProfileId: reviewer.profileId,
      user: setup.user,
    });
    expect(result.removed).toBe(true);

    const assignments = await getAssignments(instance.instance.id);
    const reviewerAssignments = assignments.filter(
      (a) => a.reviewerProfileId === reviewer.profileId,
    );

    // The pending assignment is gone; the in-progress one survives.
    expect(reviewerAssignments).toHaveLength(1);
    expect(reviewerAssignments[0]?.proposalId).toBe(pInProgress!.id);
    expect(reviewerAssignments[0]?.status).toBe(
      ProposalReviewAssignmentStatus.IN_PROGRESS,
    );

    // The rubric review the kept assignment owns is intact (no cascade fired).
    const survivingReview = await db
      .select()
      .from(proposalReviews)
      .where(eq(proposalReviews.assignmentId, inProgressAssignment!.id));
    expect(survivingReview).toHaveLength(1);
  });

  it('keeps a pending assignment still justified by another category (full recompute, not delta-prune)', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance } = await createReviewInstance(
      testData,
      'by_category',
    );
    const reviewerRole = await createReviewerRole(instance.profileId);
    const [termA, termB] = await seedTerms(2, onTestFinished);

    // dualReviewer covers cats A AND B; soloReviewer covers cat A only.
    const [dualReviewer, soloReviewer] = await Promise.all([
      testData.createMemberUser({
        organization: setup.organization,
        instanceProfileIds: [instance.profileId],
        roleIds: { [instance.profileId]: reviewerRole.id },
      }),
      testData.createMemberUser({
        organization: setup.organization,
        instanceProfileIds: [instance.profileId],
        roleIds: { [instance.profileId]: reviewerRole.id },
      }),
    ]);

    // The proposal wears BOTH categories.
    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Dual-category proposal' },
      status: ProposalStatus.SUBMITTED,
    });
    await tagProposal(proposal.id, termA!.id);
    await tagProposal(proposal.id, termB!.id);

    await scopeReviewer({
      processInstanceId: instance.instance.id,
      taxonomyTermId: termA!.id,
      reviewerProfileId: dualReviewer.profileId,
    });
    await scopeReviewer({
      processInstanceId: instance.instance.id,
      taxonomyTermId: termB!.id,
      reviewerProfileId: dualReviewer.profileId,
    });
    await scopeReviewer({
      processInstanceId: instance.instance.id,
      taxonomyTermId: termA!.id,
      reviewerProfileId: soloReviewer.profileId,
    });

    await generateBaseline(instance.instance.id);

    // Both reviewers assigned, both still `pending`.
    await removeCategoryReviewer({
      processInstanceId: instance.instance.id,
      taxonomyTermId: termA!.id,
      reviewerProfileId: dualReviewer.profileId,
      user: setup.user,
    });
    await removeCategoryReviewer({
      processInstanceId: instance.instance.id,
      taxonomyTermId: termA!.id,
      reviewerProfileId: soloReviewer.profileId,
      user: setup.user,
    });

    const reviewers =
      reviewersByProposal(await getAssignments(instance.instance.id)).get(
        proposal.id,
      ) ?? new Set<string>();

    // dualReviewer's pending assignment survives — the recompute still finds
    // the cat-B justification. soloReviewer's is pruned — nothing justifies it.
    expect(reviewers.has(dualReviewer.profileId)).toBe(true);
    expect(reviewers.has(soloReviewer.profileId)).toBe(false);
  });
});

describe.concurrent('reconcileReviewAssignments — recategorization', () => {
  it('adds new-category reviewers, prunes dropped-category pending, and keeps dropped-category non-pending', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance } = await createReviewInstance(
      testData,
      'by_category',
    );
    const reviewerRole = await createReviewerRole(instance.profileId);
    const [termA, termB] = await seedTerms(2, onTestFinished);

    // Cat A: one pending reviewer (pruned) + one in-progress reviewer (kept).
    // Cat B: a reviewer the proposal will gain (added).
    const [pendingReviewer, keptReviewer, newReviewer] = await Promise.all([
      testData.createMemberUser({
        organization: setup.organization,
        instanceProfileIds: [instance.profileId],
        roleIds: { [instance.profileId]: reviewerRole.id },
      }),
      testData.createMemberUser({
        organization: setup.organization,
        instanceProfileIds: [instance.profileId],
        roleIds: { [instance.profileId]: reviewerRole.id },
      }),
      testData.createMemberUser({
        organization: setup.organization,
        instanceProfileIds: [instance.profileId],
        roleIds: { [instance.profileId]: reviewerRole.id },
      }),
    ]);

    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Recategorized proposal' },
      status: ProposalStatus.SUBMITTED,
    });

    await tagProposal(proposal.id, termA!.id);
    await scopeReviewer({
      processInstanceId: instance.instance.id,
      taxonomyTermId: termA!.id,
      reviewerProfileId: pendingReviewer.profileId,
    });
    await scopeReviewer({
      processInstanceId: instance.instance.id,
      taxonomyTermId: termA!.id,
      reviewerProfileId: keptReviewer.profileId,
    });
    await scopeReviewer({
      processInstanceId: instance.instance.id,
      taxonomyTermId: termB!.id,
      reviewerProfileId: newReviewer.profileId,
    });

    await generateBaseline(instance.instance.id);

    // keptReviewer starts working — their assignment leaves `pending`.
    await db
      .update(proposalReviewAssignments)
      .set({ status: ProposalReviewAssignmentStatus.IN_PROGRESS })
      .where(
        and(
          eq(proposalReviewAssignments.proposalId, proposal.id),
          eq(
            proposalReviewAssignments.reviewerProfileId,
            keptReviewer.profileId,
          ),
        ),
      );

    // Recategorize A → B inside a tx and reconcile in the same tx — exactly the
    // path updateProposal takes after setProposalCategories.
    await db.transaction(async (tx) => {
      await tx
        .delete(proposalCategories)
        .where(eq(proposalCategories.proposalId, proposal.id));
      await tx
        .insert(proposalCategories)
        .values({ proposalId: proposal.id, taxonomyTermId: termB!.id });
      await reconcileReviewAssignments({
        db: tx,
        instanceId: instance.instance.id,
        affected: { proposalIds: [proposal.id] },
      });
    });

    const byProposal = reviewersByProposal(
      await getAssignments(instance.instance.id),
    );
    const reviewers = byProposal.get(proposal.id) ?? new Set<string>();

    // New cat-B reviewer added; kept (in-progress) cat-A reviewer survives even
    // though cat A was dropped; pending cat-A reviewer pruned.
    expect(reviewers.has(newReviewer.profileId)).toBe(true);
    expect(reviewers.has(keptReviewer.profileId)).toBe(true);
    expect(reviewers.has(pendingReviewer.profileId)).toBe(false);
  });

  it('updateProposal itself reconciles: editing categories moves the assignments in the same call', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance } = await createReviewInstance(
      testData,
      'by_category',
    );
    const reviewerRole = await createReviewerRole(instance.profileId);
    const [termA, termB] = await seedTerms(2, onTestFinished);

    const [reviewerA, reviewerB] = await Promise.all([
      testData.createMemberUser({
        organization: setup.organization,
        instanceProfileIds: [instance.profileId],
        roleIds: { [instance.profileId]: reviewerRole.id },
      }),
      testData.createMemberUser({
        organization: setup.organization,
        instanceProfileIds: [instance.profileId],
        roleIds: { [instance.profileId]: reviewerRole.id },
      }),
    ]);

    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Edited proposal' },
      status: ProposalStatus.SUBMITTED,
    });
    await tagProposal(proposal.id, termA!.id);

    await scopeReviewer({
      processInstanceId: instance.instance.id,
      taxonomyTermId: termA!.id,
      reviewerProfileId: reviewerA.profileId,
    });
    await scopeReviewer({
      processInstanceId: instance.instance.id,
      taxonomyTermId: termB!.id,
      reviewerProfileId: reviewerB.profileId,
    });

    await generateBaseline(instance.instance.id);

    // The real service path: updateProposal → setProposalCategories →
    // reconcileReviewAssignments, all inside its own write transaction.
    // Categories resolve by term LABEL here (setProposalCategories contract).
    await updateProposal({
      proposalId: proposal.id,
      data: {
        proposalData: { title: 'Edited proposal', category: [termB!.label] },
      },
      user: setup.user,
    });

    const reviewers =
      reviewersByProposal(await getAssignments(instance.instance.id)).get(
        proposal.id,
      ) ?? new Set<string>();

    // A → B took effect without any explicit reconcile call: B's reviewer
    // assigned, A's pending reviewer pruned.
    expect(reviewers.has(reviewerB.profileId)).toBe(true);
    expect(reviewers.has(reviewerA.profileId)).toBe(false);
  });
});

describe.concurrent('reconcileReviewAssignments — no-op guards', () => {
  it("skips when scope is 'all' and touches no assignments", async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance } = await createReviewInstance(testData, 'all');
    const [termA] = await seedTerms(1, onTestFinished);

    // A reviewer other than the author, so full coverage produces a non-empty
    // baseline the no-op guard can then be shown not to touch.
    const reviewerRole = await createReviewerRole(instance.profileId);
    await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
      roleIds: { [instance.profileId]: reviewerRole.id },
    });

    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Full-coverage proposal' },
      status: ProposalStatus.SUBMITTED,
    });
    await tagProposal(proposal.id, termA!.id);

    await generateBaseline(instance.instance.id);
    const baseline = await getAssignments(instance.instance.id);
    // Guard the guard: an empty baseline would make the length check below
    // pass for the wrong reason.
    expect(baseline.length).toBeGreaterThan(0);

    const result = await reconcileReviewAssignments({
      instanceId: instance.instance.id,
      affected: { taxonomyTermId: termA!.id },
    });

    expect(result).toEqual({
      skipped: 'current phase scope is not by_category',
    });
    expect(await getAssignments(instance.instance.id)).toHaveLength(
      baseline.length,
    );
  });

  it('skips when the current phase is not a review phase', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instance } = await createReviewInstance(testData, 'by_category');
    const [termA] = await seedTerms(1, onTestFinished);

    // Never advanced out of the submission phase.
    const result = await reconcileReviewAssignments({
      instanceId: instance.instance.id,
      affected: { taxonomyTermId: termA!.id },
    });

    expect(result).toEqual({ skipped: 'current phase is not review-capable' });
  });

  it('skips when the instance is a draft (not published)', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instance } = await createReviewInstance(
      testData,
      'by_category',
      ProcessStatus.DRAFT,
    );
    const [termA] = await seedTerms(1, onTestFinished);

    const result = await reconcileReviewAssignments({
      instanceId: instance.instance.id,
      affected: { taxonomyTermId: termA!.id },
    });

    expect(result).toMatchObject({
      skipped: expect.stringContaining('published'),
    });
  });
});
