import {
  type DecisionInstanceData,
  type ReviewsScope,
  advancePhase,
  backfillReviewAssignments,
  createDecisionRole,
  generateReviewAssignments,
} from '@op/common';
import { db, eq, inArray } from '@op/db/client';
import {
  ProcessStatus,
  ProposalStatus,
  categoryReviewers,
  proposalCategories,
  proposalReviewAssignments,
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
 * Schema whose review phase carries a configurable `reviews.scope`. The review
 * phase also accepts submissions so backfill tests can add mid-phase proposals.
 * submission → review → results
 */
function schemaWithScope(scope: ReviewsScope): TestProcessSchema {
  return {
    id: `review-by-category-schema-${scope}`,
    version: '1.0.0',
    name: 'Review By Category Schema',
    description: 'Schema with a by-category review phase for testing',
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
) {
  const setup = await testData.createDecisionSetup({
    instanceCount: 1,
    processSchema: schemaWithScope(scope),
    status: ProcessStatus.PUBLISHED,
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

describe.concurrent('generateReviewAssignments — by_category scope', () => {
  it("scope 'all' still assigns every eligible reviewer to every proposal, ignoring category scope", async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance } = await createReviewInstance(testData, 'all');
    const reviewerRole = await createReviewerRole(instance.profileId);
    const [termA] = await seedTerms(1, onTestFinished);

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

    const [p1, p2] = await Promise.all([
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'P1' },
        status: ProposalStatus.SUBMITTED,
      }),
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'P2' },
        status: ProposalStatus.SUBMITTED,
      }),
    ]);

    // reviewerA is scoped only to category A — under 'all' this must be ignored.
    await tagProposal(p1!.id, termA!.id);
    await scopeReviewer({
      processInstanceId: instance.instance.id,
      taxonomyTermId: termA!.id,
      reviewerProfileId: reviewerA.profileId,
    });

    const advanceResult = await advanceToReviewPhase(instance.instance.id);
    await generateReviewAssignments({
      instanceId: instance.instance.id,
      phaseId: 'review',
      selectedProposalIds: advanceResult.selectedProposalIds,
      transitionHistoryId: advanceResult.transitionHistoryId,
    });

    const byProposal = reviewersByProposal(
      await getAssignments(instance.instance.id),
    );

    // Full coverage ignores category scope: both reviewers cover both proposals
    // despite reviewerA's cat-A-only scope row (note reviewerA gets p2, not in
    // cat A). Superset check — the creator-admin also holds REVIEW.
    for (const p of [p1!, p2!]) {
      const reviewers = byProposal.get(p.id);
      expect(reviewers?.has(reviewerA.profileId)).toBe(true);
      expect(reviewers?.has(reviewerB.profileId)).toBe(true);
    }
    expect(byProposal.get(p2!.id)?.has(reviewerA.profileId)).toBe(true);
  });

  it('assigns each proposal only its category-scoped, eligible reviewers', async ({
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

    const advanceResult = await advanceToReviewPhase(instance.instance.id);
    await generateReviewAssignments({
      instanceId: instance.instance.id,
      phaseId: 'review',
      selectedProposalIds: advanceResult.selectedProposalIds,
      transitionHistoryId: advanceResult.transitionHistoryId,
    });

    const byProposal = reviewersByProposal(
      await getAssignments(instance.instance.id),
    );

    // reviewerA covers cat-A proposal only; reviewerB covers cat-B only.
    expect(byProposal.get(pA!.id)).toEqual(new Set([reviewerA.profileId]));
    expect(byProposal.get(pB!.id)).toEqual(new Set([reviewerB.profileId]));
  });

  it('unions reviewers across a multi-category proposal without duplicate rows', async ({
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

    // reviewerBoth is scoped to BOTH categories — the dedupe target.
    const [reviewerA, reviewerB, reviewerBoth] = await Promise.all([
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
      proposalData: { title: 'Multi-category proposal' },
      status: ProposalStatus.SUBMITTED,
    });

    await tagProposal(proposal.id, termA!.id);
    await tagProposal(proposal.id, termB!.id);
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
    await scopeReviewer({
      processInstanceId: instance.instance.id,
      taxonomyTermId: termA!.id,
      reviewerProfileId: reviewerBoth.profileId,
    });
    await scopeReviewer({
      processInstanceId: instance.instance.id,
      taxonomyTermId: termB!.id,
      reviewerProfileId: reviewerBoth.profileId,
    });

    const advanceResult = await advanceToReviewPhase(instance.instance.id);
    await generateReviewAssignments({
      instanceId: instance.instance.id,
      phaseId: 'review',
      selectedProposalIds: advanceResult.selectedProposalIds,
      transitionHistoryId: advanceResult.transitionHistoryId,
    });

    const assignments = await getAssignments(instance.instance.id);
    const proposalAssignments = assignments.filter(
      (a) => a.proposalId === proposal.id,
    );

    // Union of both categories' reviewers, and reviewerBoth appears once — the
    // (instance, proposal, reviewer, phase) unique constraint dedupes.
    expect(reviewersByProposal(assignments).get(proposal.id)).toEqual(
      new Set([
        reviewerA.profileId,
        reviewerB.profileId,
        reviewerBoth.profileId,
      ]),
    );
    expect(proposalAssignments).toHaveLength(3);
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
    const reviewerRole = await createReviewerRole(instance.profileId);
    const [termA] = await seedTerms(1, onTestFinished);

    // reviewer has the role; nonReviewer is scoped but has no REVIEW role.
    const [reviewer, nonReviewer] = await Promise.all([
      testData.createMemberUser({
        organization: setup.organization,
        instanceProfileIds: [instance.profileId],
        roleIds: { [instance.profileId]: reviewerRole.id },
      }),
      testData.createMemberUser({
        organization: setup.organization,
        instanceProfileIds: [instance.profileId],
      }),
    ]);

    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Cat A proposal' },
      status: ProposalStatus.SUBMITTED,
    });

    await tagProposal(proposal.id, termA!.id);
    await scopeReviewer({
      processInstanceId: instance.instance.id,
      taxonomyTermId: termA!.id,
      reviewerProfileId: reviewer.profileId,
    });
    await scopeReviewer({
      processInstanceId: instance.instance.id,
      taxonomyTermId: termA!.id,
      reviewerProfileId: nonReviewer.profileId,
    });

    const advanceResult = await advanceToReviewPhase(instance.instance.id);
    await generateReviewAssignments({
      instanceId: instance.instance.id,
      phaseId: 'review',
      selectedProposalIds: advanceResult.selectedProposalIds,
      transitionHistoryId: advanceResult.transitionHistoryId,
    });

    const byProposal = reviewersByProposal(
      await getAssignments(instance.instance.id),
    );

    // Only the role-holding reviewer is assigned; the scope row alone grants nothing.
    expect(byProposal.get(proposal.id)).toEqual(new Set([reviewer.profileId]));
  });

  it('still excludes self-review when the author is scoped to their own proposal category', async ({
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

    // Author is also a reviewer scoped to cat A; another reviewer covers cat A too.
    const [author, otherReviewer] = await Promise.all([
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

    const ownProposal = await testData.createProposal({
      userEmail: author.email,
      processInstanceId: instance.instance.id,
      proposalData: { title: "Author's own proposal" },
      status: ProposalStatus.SUBMITTED,
    });

    await tagProposal(ownProposal.id, termA!.id);
    await scopeReviewer({
      processInstanceId: instance.instance.id,
      taxonomyTermId: termA!.id,
      reviewerProfileId: author.profileId,
    });
    await scopeReviewer({
      processInstanceId: instance.instance.id,
      taxonomyTermId: termA!.id,
      reviewerProfileId: otherReviewer.profileId,
    });

    const advanceResult = await advanceToReviewPhase(instance.instance.id);
    await generateReviewAssignments({
      instanceId: instance.instance.id,
      phaseId: 'review',
      selectedProposalIds: advanceResult.selectedProposalIds,
      transitionHistoryId: advanceResult.transitionHistoryId,
    });

    const byProposal = reviewersByProposal(
      await getAssignments(instance.instance.id),
    );

    // Author is scoped to their own category but never reviews their own work.
    expect(byProposal.get(ownProposal.id)).toEqual(
      new Set([otherReviewer.profileId]),
    );
  });

  it('inserts no rows for 0-reviewer-category and uncategorized proposals, without blocking the transition', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance } = await createReviewInstance(
      testData,
      'by_category',
    );
    const reviewerRole = await createReviewerRole(instance.profileId);
    const [termCovered, termEmpty] = await seedTerms(2, onTestFinished);

    const reviewer = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
      roleIds: { [instance.profileId]: reviewerRole.id },
    });

    const [covered, emptyCategory, uncategorized] = await Promise.all([
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'Covered' },
        status: ProposalStatus.SUBMITTED,
      }),
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'Empty category' },
        status: ProposalStatus.SUBMITTED,
      }),
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'Uncategorized' },
        status: ProposalStatus.SUBMITTED,
      }),
    ]);

    // Only `covered` has a scoped reviewer; `emptyCategory` has a category with
    // no scope rows; `uncategorized` has no category at all.
    await tagProposal(covered.id, termCovered!.id);
    await tagProposal(emptyCategory.id, termEmpty!.id);
    await scopeReviewer({
      processInstanceId: instance.instance.id,
      taxonomyTermId: termCovered!.id,
      reviewerProfileId: reviewer.profileId,
    });

    const advanceResult = await advanceToReviewPhase(instance.instance.id);
    await expect(
      generateReviewAssignments({
        instanceId: instance.instance.id,
        phaseId: 'review',
        selectedProposalIds: advanceResult.selectedProposalIds,
        transitionHistoryId: advanceResult.transitionHistoryId,
      }),
    ).resolves.toBeUndefined();

    const assignments = await getAssignments(instance.instance.id);

    // The covered proposal is assigned; the two gap proposals get no rows.
    expect(reviewersByProposal(assignments).get(covered.id)).toEqual(
      new Set([reviewer.profileId]),
    );
    expect(
      assignments.filter((a) => a.proposalId === emptyCategory.id),
    ).toHaveLength(0);
    expect(
      assignments.filter((a) => a.proposalId === uncategorized.id),
    ).toHaveLength(0);
  });

  it('resolves active-phase and instance-wide scope rows, excludes other-phase rows, and dedupes their overlap', async ({
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

    const [reviewerPhase, reviewerOther, reviewerWide, reviewerDual] =
      await Promise.all([
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
        testData.createMemberUser({
          organization: setup.organization,
          instanceProfileIds: [instance.profileId],
          roleIds: { [instance.profileId]: reviewerRole.id },
        }),
      ]);

    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Cat A proposal' },
      status: ProposalStatus.SUBMITTED,
    });

    await tagProposal(proposal.id, termA!.id);
    // Scoped to the active review phase → resolves.
    await scopeReviewer({
      processInstanceId: instance.instance.id,
      taxonomyTermId: termA!.id,
      reviewerProfileId: reviewerPhase.profileId,
      phaseId: 'review',
    });
    // Scoped to a DIFFERENT phase → must NOT leak into the review phase.
    await scopeReviewer({
      processInstanceId: instance.instance.id,
      taxonomyTermId: termA!.id,
      reviewerProfileId: reviewerOther.profileId,
      phaseId: 'submission',
    });
    // Instance-wide (phaseId NULL) → resolves for the review phase.
    await scopeReviewer({
      processInstanceId: instance.instance.id,
      taxonomyTermId: termA!.id,
      reviewerProfileId: reviewerWide.profileId,
      phaseId: null,
    });
    // Both instance-wide AND active-phase rows for the same term → the OR union
    // matches twice but must collapse to a single assignment row.
    await scopeReviewer({
      processInstanceId: instance.instance.id,
      taxonomyTermId: termA!.id,
      reviewerProfileId: reviewerDual.profileId,
      phaseId: null,
    });
    await scopeReviewer({
      processInstanceId: instance.instance.id,
      taxonomyTermId: termA!.id,
      reviewerProfileId: reviewerDual.profileId,
      phaseId: 'review',
    });

    const advanceResult = await advanceToReviewPhase(instance.instance.id);
    await generateReviewAssignments({
      instanceId: instance.instance.id,
      phaseId: 'review',
      selectedProposalIds: advanceResult.selectedProposalIds,
      transitionHistoryId: advanceResult.transitionHistoryId,
    });

    const assignments = await getAssignments(instance.instance.id);

    // Active-phase + instance-wide rows resolve; the other-phase row does not.
    expect(reviewersByProposal(assignments).get(proposal.id)).toEqual(
      new Set([
        reviewerPhase.profileId,
        reviewerWide.profileId,
        reviewerDual.profileId,
      ]),
    );

    // reviewerDual's overlapping NULL + 'review' rows dedupe to one assignment.
    expect(
      assignments.filter(
        (a) =>
          a.proposalId === proposal.id &&
          a.reviewerProfileId === reviewerDual.profileId,
      ),
    ).toHaveLength(1);
  });

  it('scopes reviewers per instance: an instance-one scope row never covers an identical-category proposal in instance two', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 2,
      processSchema: schemaWithScope('by_category'),
      status: ProcessStatus.PUBLISHED,
    });
    const instanceOne = setup.instances[0]!;
    const instanceTwo = setup.instances[1]!;

    // The reviewer holds REVIEW in BOTH instances, so eligibility cannot explain
    // the instance-two exclusion — only the per-instance scope filter can.
    const [roleOne, roleTwo] = await Promise.all([
      createReviewerRole(instanceOne.profileId),
      createReviewerRole(instanceTwo.profileId),
    ]);
    const [termA] = await seedTerms(1, onTestFinished);

    const reviewer = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instanceOne.profileId, instanceTwo.profileId],
      roleIds: {
        [instanceOne.profileId]: roleOne.id,
        [instanceTwo.profileId]: roleTwo.id,
      },
    });

    const [proposalOne, proposalTwo] = await Promise.all([
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instanceOne.instance.id,
        proposalData: { title: 'Instance one proposal' },
        status: ProposalStatus.SUBMITTED,
      }),
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instanceTwo.instance.id,
        proposalData: { title: 'Instance two proposal' },
        status: ProposalStatus.SUBMITTED,
      }),
    ]);

    // Both proposals share the SAME category term...
    await tagProposal(proposalOne.id, termA!.id);
    await tagProposal(proposalTwo.id, termA!.id);
    // ...but only instance one has a scope row for it.
    await scopeReviewer({
      processInstanceId: instanceOne.instance.id,
      taxonomyTermId: termA!.id,
      reviewerProfileId: reviewer.profileId,
    });

    // Generation runs for BOTH instances.
    const advanceOne = await advanceToReviewPhase(instanceOne.instance.id);
    await generateReviewAssignments({
      instanceId: instanceOne.instance.id,
      phaseId: 'review',
      selectedProposalIds: advanceOne.selectedProposalIds,
      transitionHistoryId: advanceOne.transitionHistoryId,
    });
    const advanceTwo = await advanceToReviewPhase(instanceTwo.instance.id);
    await generateReviewAssignments({
      instanceId: instanceTwo.instance.id,
      phaseId: 'review',
      selectedProposalIds: advanceTwo.selectedProposalIds,
      transitionHistoryId: advanceTwo.transitionHistoryId,
    });

    // Instance one: the scope row applies.
    expect(
      reviewersByProposal(await getAssignments(instanceOne.instance.id)).get(
        proposalOne.id,
      ),
    ).toEqual(new Set([reviewer.profileId]));

    // Instance two: same term, same eligible reviewer, generation ran — but the
    // scope row belongs to instance one, so nothing is assigned here.
    expect(await getAssignments(instanceTwo.instance.id)).toHaveLength(0);
  });
});

describe.concurrent('backfillReviewAssignments — by_category scope', () => {
  it('backfills a mid-phase reviewer only for proposals in their scoped categories', async ({
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

    // initialReviewer covers cat A from the start; lateReviewer joins mid-phase
    // scoped only to cat A.
    const [initialReviewer, lateReviewer] = await Promise.all([
      testData.createMemberUser({
        organization: setup.organization,
        instanceProfileIds: [instance.profileId],
        roleIds: { [instance.profileId]: reviewerRole.id },
      }),
      testData.createMemberUser({
        organization: setup.organization,
        instanceProfileIds: [instance.profileId],
      }),
    ]);

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
    await scopeReviewer({
      processInstanceId: instance.instance.id,
      taxonomyTermId: termA!.id,
      reviewerProfileId: initialReviewer.profileId,
    });

    const advanceResult = await advanceToReviewPhase(instance.instance.id);
    await generateReviewAssignments({
      instanceId: instance.instance.id,
      phaseId: 'review',
      selectedProposalIds: advanceResult.selectedProposalIds,
      transitionHistoryId: advanceResult.transitionHistoryId,
    });
    const afterGeneration = await getAssignments(instance.instance.id);

    // lateReviewer gains the role AND a cat-A scope row mid-phase.
    await testData.assignRole(
      lateReviewer.authUserId,
      instance.profileId,
      reviewerRole.id,
    );
    await scopeReviewer({
      processInstanceId: instance.instance.id,
      taxonomyTermId: termA!.id,
      reviewerProfileId: lateReviewer.profileId,
    });

    const result = await backfillReviewAssignments({
      instanceId: instance.instance.id,
      reviewerProfileIds: [lateReviewer.profileId],
    });

    // Only the cat-A proposal is backfilled for lateReviewer; cat-B is out of scope.
    expect(result).toMatchObject({ inserted: 1, reviewerCount: 1 });

    const assignments = await getAssignments(instance.instance.id);
    const lateAssignments = assignments.filter(
      (a) => a.reviewerProfileId === lateReviewer.profileId,
    );
    expect(lateAssignments).toHaveLength(1);
    expect(lateAssignments[0]?.proposalId).toBe(pA!.id);

    // Add-only: exactly one new row over the generation baseline.
    expect(assignments).toHaveLength(afterGeneration.length + 1);
  });
});
