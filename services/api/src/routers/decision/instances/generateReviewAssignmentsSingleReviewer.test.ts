import {
  type DecisionInstanceData,
  type ReviewsPolicy,
  type ReviewsScope,
  advancePhase,
  backfillReviewAssignments,
  createDecisionRole,
  generateReviewAssignments,
  reconcileReviewAssignments,
} from '@op/common';
import { db, eq, inArray } from '@op/db/client';
import {
  ProcessStatus,
  ProposalStatus,
  categoryReviewers,
  profileUserToAccessRoles,
  proposalCategories,
  proposalReviewAssignments,
  taxonomies,
  taxonomyTerms,
} from '@op/db/schema';
import { logger } from '@op/logging';
import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';

/** The schema shape createDecisionSetup accepts (encoder-inferred, not exported). */
type TestProcessSchema = NonNullable<
  NonNullable<
    Parameters<TestDecisionsDataManager['createDecisionSetup']>[0]
  >['processSchema']
>;

/**
 * submission → review → results, with the review phase carrying both review
 * axes (`reviews.policy` and `reviews.scope`) so the `single_reviewer` policy
 * can be exercised under either scope. The review phase also accepts
 * submissions so a mid-phase backfill is representable.
 */
function schemaWith(policy: ReviewsPolicy, scope: ReviewsScope) {
  return {
    id: `review-single-reviewer-schema-${policy}-${scope}`,
    version: '1.0.0',
    name: 'Single Reviewer Schema',
    description: 'Schema with a single-reviewer review phase for testing',
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
          reviews: { submit: true, policy, scope },
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
  policy: ReviewsPolicy,
  scope: ReviewsScope,
) {
  const setup = await testData.createDecisionSetup({
    instanceCount: 1,
    processSchema: schemaWith(policy, scope),
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

/**
 * Drops every decision-role assignment an auth user holds on the instance
 * profile. The creator-admin holds REVIEW by default, so this is how a test
 * builds an instance whose only eligible reviewer is the one it created.
 */
async function revokeInstanceRoles(authUserId: string, profileId: string) {
  const profileUser = await db.query.profileUsers.findFirst({
    where: { authUserId, profileId },
  });
  if (!profileUser) {
    throw new Error(`No profileUser for authUser=${authUserId}`);
  }

  await db
    .delete(profileUserToAccessRoles)
    .where(eq(profileUserToAccessRoles.profileUserId, profileUser.id));
}

/** Directly inserts a scope row (system context — no admin caller needed). */
async function scopeReviewer({
  processInstanceId,
  taxonomyTermId,
  reviewerProfileId,
}: {
  processInstanceId: string;
  taxonomyTermId: string;
  reviewerProfileId: string;
}) {
  await db
    .insert(categoryReviewers)
    .values({
      processInstanceId,
      taxonomyTermId,
      reviewerProfileId,
      phaseId: null,
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

/** proposalId → reviewerProfileIds actually assigned. */
function reviewersByProposal(
  assignments: Array<{ proposalId: string; reviewerProfileId: string }>,
) {
  const map = new Map<string, string[]>();
  for (const a of assignments) {
    const bucket = map.get(a.proposalId) ?? [];
    bucket.push(a.reviewerProfileId);
    map.set(a.proposalId, bucket);
  }
  return map;
}

/** reviewerProfileId → number of proposals assigned, for balance assertions. */
function loadByReviewer(
  assignments: Array<{ reviewerProfileId: string }>,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const a of assignments) {
    counts.set(a.reviewerProfileId, (counts.get(a.reviewerProfileId) ?? 0) + 1);
  }
  return counts;
}

async function generate(instanceId: string) {
  const advanceResult = await advanceToReviewPhase(instanceId);
  await generateReviewAssignments({
    instanceId,
    phaseId: 'review',
    selectedProposalIds: advanceResult.selectedProposalIds,
    transitionHistoryId: advanceResult.transitionHistoryId,
  });
  return advanceResult;
}

describe.concurrent('generateReviewAssignments — single_reviewer policy', () => {
  it("scope 'all': assigns exactly one reviewer per proposal, balanced across reviewers", async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance } = await createReviewInstance(
      testData,
      'single_reviewer',
      'all',
    );
    const reviewerRole = await createReviewerRole(instance.profileId);

    // Two extra reviewers alongside the creator-admin (who holds REVIEW via
    // createDefaultDecisionRoles) → three candidates for every proposal.
    const [reviewerA, reviewerB, author] = await Promise.all([
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
      // No REVIEW role, so authoring never removes a candidate.
      testData.createMemberUser({
        organization: setup.organization,
        instanceProfileIds: [instance.profileId],
      }),
    ]);

    const proposals = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        testData.createProposal({
          userEmail: author.email,
          processInstanceId: instance.instance.id,
          proposalData: { title: `Proposal ${i}` },
          status: ProposalStatus.SUBMITTED,
        }),
      ),
    );

    await generate(instance.instance.id);

    const assignments = await getAssignments(instance.instance.id);
    const byProposal = reviewersByProposal(assignments);

    // Exactly one assignment per proposal — not full coverage's 3 × 6 = 18.
    expect(assignments).toHaveLength(6);
    for (const proposal of proposals) {
      expect(byProposal.get(proposal.id)).toHaveLength(1);
    }

    // 6 proposals over 3 candidates → an even 2/2/2 split.
    const load = loadByReviewer(assignments);
    expect(load.size).toBe(3);
    expect([...load.values()]).toEqual([2, 2, 2]);
    expect(load.has(reviewerA.profileId)).toBe(true);
    expect(load.has(reviewerB.profileId)).toBe(true);

    // The history snapshot is still pinned on the single row.
    for (const a of assignments) {
      expect(a.assignedProposalHistoryId).not.toBeNull();
    }
  });

  it("scope 'all': never picks the author, even when they are the more lightly loaded reviewer", async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance } = await createReviewInstance(
      testData,
      'single_reviewer',
      'all',
    );
    const reviewerRole = await createReviewerRole(instance.profileId);

    // Both reviewers author proposals, so the picker must exclude each of them
    // from their own — the downstream filter can't do it without losing coverage.
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

    const [proposalByA, proposalByB] = await Promise.all([
      testData.createProposal({
        userEmail: reviewerA.email,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'By reviewer A' },
        status: ProposalStatus.SUBMITTED,
      }),
      testData.createProposal({
        userEmail: reviewerB.email,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'By reviewer B' },
        status: ProposalStatus.SUBMITTED,
      }),
    ]);

    await generate(instance.instance.id);

    const assignments = await getAssignments(instance.instance.id);
    const byProposal = reviewersByProposal(assignments);

    // Each authored proposal is covered by exactly one non-author reviewer.
    expect(byProposal.get(proposalByA.id)).toHaveLength(1);
    expect(byProposal.get(proposalByA.id)).not.toContain(reviewerA.profileId);
    expect(byProposal.get(proposalByB.id)).toHaveLength(1);
    expect(byProposal.get(proposalByB.id)).not.toContain(reviewerB.profileId);
  });

  it("scope 'all': warns and writes nothing when the author is the only eligible reviewer", async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance } = await createReviewInstance(
      testData,
      'single_reviewer',
      'all',
    );
    const reviewerRole = await createReviewerRole(instance.profileId);

    const soleReviewer = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
      roleIds: { [instance.profileId]: reviewerRole.id },
    });

    // Strip the creator-admin's REVIEW so soleReviewer is the whole eligible
    // set — and have them author the proposal, emptying the candidate set.
    await revokeInstanceRoles(setup.user.id, instance.profileId);

    const proposal = await testData.createProposal({
      userEmail: soleReviewer.email,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Authored by the only reviewer' },
      status: ProposalStatus.SUBMITTED,
    });

    // Warn, never block.
    await expect(generate(instance.instance.id)).resolves.toBeDefined();

    expect(await getAssignments(instance.instance.id)).toHaveLength(0);

    const warnFor = vi
      .mocked(logger.warn)
      .mock.calls.find(
        ([, meta]) =>
          (meta as { proposalId?: string } | undefined)?.proposalId ===
          proposal.id,
      );
    expect(warnFor?.[1]).toMatchObject({
      instanceId: instance.instance.id,
      phaseId: 'review',
      reason: 'no_eligible_reviewers',
    });
  });

  it('is idempotent: a re-run leaves the original single assignment untouched', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance } = await createReviewInstance(
      testData,
      'single_reviewer',
      'all',
    );
    const reviewerRole = await createReviewerRole(instance.profileId);

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
    ]);

    const author = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });

    await Promise.all(
      Array.from({ length: 3 }, (_, i) =>
        testData.createProposal({
          userEmail: author.email,
          processInstanceId: instance.instance.id,
          proposalData: { title: `Proposal ${i}` },
          status: ProposalStatus.SUBMITTED,
        }),
      ),
    );

    const advanceResult = await generate(instance.instance.id);
    const firstRun = await getAssignments(instance.instance.id);

    // Re-run the same transition — the coverage guard, not just
    // onConflictDoNothing, has to stop a second (different) reviewer landing.
    await generateReviewAssignments({
      instanceId: instance.instance.id,
      phaseId: 'review',
      selectedProposalIds: advanceResult.selectedProposalIds,
      transitionHistoryId: advanceResult.transitionHistoryId,
    });

    const secondRun = await getAssignments(instance.instance.id);
    expect(secondRun).toHaveLength(3);
    expect(secondRun.map((a) => a.id).sort()).toEqual(
      firstRun.map((a) => a.id).sort(),
    );
  });

  it('is deterministic: regenerating from a cleared table reproduces the same picks', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance } = await createReviewInstance(
      testData,
      'single_reviewer',
      'all',
    );
    const reviewerRole = await createReviewerRole(instance.profileId);

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
    ]);

    const author = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });

    await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        testData.createProposal({
          userEmail: author.email,
          processInstanceId: instance.instance.id,
          proposalData: { title: `Proposal ${i}` },
          status: ProposalStatus.SUBMITTED,
        }),
      ),
    );

    const advanceResult = await generate(instance.instance.id);
    const firstPicks = reviewersByProposal(
      await getAssignments(instance.instance.id),
    );

    // Wipe the rows so the idempotency guard doesn't short-circuit the re-run:
    // the picks must come out identical from the stable md5 tie-break alone.
    await db
      .delete(proposalReviewAssignments)
      .where(
        eq(proposalReviewAssignments.processInstanceId, instance.instance.id),
      );

    await generateReviewAssignments({
      instanceId: instance.instance.id,
      phaseId: 'review',
      selectedProposalIds: advanceResult.selectedProposalIds,
      transitionHistoryId: advanceResult.transitionHistoryId,
    });

    const secondPicks = reviewersByProposal(
      await getAssignments(instance.instance.id),
    );

    expect([...secondPicks.entries()].sort()).toEqual(
      [...firstPicks.entries()].sort(),
    );
  });

  it("scope 'by_category': picks one scoped reviewer per proposal and warns on an uncovered category", async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance } = await createReviewInstance(
      testData,
      'single_reviewer',
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

    // Four cat-A proposals (both reviewers scoped) + one cat-B proposal (nobody
    // scoped). The creator-admin holds REVIEW but has no scope row, so the
    // candidate set is exactly {reviewerA, reviewerB} for cat A.
    const catAProposals = await Promise.all(
      Array.from({ length: 4 }, (_, i) =>
        testData.createProposal({
          userEmail: setup.userEmail,
          processInstanceId: instance.instance.id,
          proposalData: { title: `Cat A proposal ${i}` },
          status: ProposalStatus.SUBMITTED,
        }),
      ),
    );
    const catBProposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Cat B proposal' },
      status: ProposalStatus.SUBMITTED,
    });

    await Promise.all([
      ...catAProposals.map((p) => tagProposal(p.id, termA!.id)),
      tagProposal(catBProposal.id, termB!.id),
    ]);
    await Promise.all([
      scopeReviewer({
        processInstanceId: instance.instance.id,
        taxonomyTermId: termA!.id,
        reviewerProfileId: reviewerA.profileId,
      }),
      scopeReviewer({
        processInstanceId: instance.instance.id,
        taxonomyTermId: termA!.id,
        reviewerProfileId: reviewerB.profileId,
      }),
    ]);

    await generate(instance.instance.id);

    const assignments = await getAssignments(instance.instance.id);
    const byProposal = reviewersByProposal(assignments);

    // One assignment per cat-A proposal, split evenly between the two scoped
    // reviewers; nothing for the uncovered cat-B proposal.
    expect(assignments).toHaveLength(4);
    for (const proposal of catAProposals) {
      expect(byProposal.get(proposal.id)).toHaveLength(1);
    }
    expect(byProposal.get(catBProposal.id)).toBeUndefined();

    const load = loadByReviewer(assignments);
    expect(load.get(reviewerA.profileId)).toBe(2);
    expect(load.get(reviewerB.profileId)).toBe(2);

    // The uncovered proposal warns once, with the by_category reason — the
    // policy layer must not add a second, vaguer warning for the same proposal.
    const warnsFor = vi
      .mocked(logger.warn)
      .mock.calls.filter(
        ([, meta]) =>
          (meta as { proposalId?: string } | undefined)?.proposalId ===
          catBProposal.id,
      );
    expect(warnsFor).toHaveLength(1);
    expect(warnsFor[0]?.[1]).toMatchObject({
      reason: 'category_has_no_eligible_reviewers',
    });
  });

  it("scope 'by_category': excludes the author from their own proposal's scoped candidates", async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance } = await createReviewInstance(
      testData,
      'single_reviewer',
      'by_category',
    );
    const reviewerRole = await createReviewerRole(instance.profileId);
    const [termA] = await seedTerms(1, onTestFinished);

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
    await Promise.all([
      scopeReviewer({
        processInstanceId: instance.instance.id,
        taxonomyTermId: termA!.id,
        reviewerProfileId: author.profileId,
      }),
      scopeReviewer({
        processInstanceId: instance.instance.id,
        taxonomyTermId: termA!.id,
        reviewerProfileId: otherReviewer.profileId,
      }),
    ]);

    await generate(instance.instance.id);

    // The author is scoped to their own category but the pick goes to the other
    // scoped reviewer — the proposal keeps its one assignment.
    expect(
      reviewersByProposal(await getAssignments(instance.instance.id)).get(
        ownProposal.id,
      ),
    ).toEqual([otherReviewer.profileId]);
  });

  it('full_coverage regression: the same setup still fans every reviewer onto every proposal', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance } = await createReviewInstance(
      testData,
      'full_coverage',
      'all',
    );
    const reviewerRole = await createReviewerRole(instance.profileId);

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
    const author = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });

    const proposals = await Promise.all(
      Array.from({ length: 3 }, (_, i) =>
        testData.createProposal({
          userEmail: author.email,
          processInstanceId: instance.instance.id,
          proposalData: { title: `Proposal ${i}` },
          status: ProposalStatus.SUBMITTED,
        }),
      ),
    );

    await generate(instance.instance.id);

    const assignments = await getAssignments(instance.instance.id);
    const byProposal = reviewersByProposal(assignments);

    // 3 reviewers (creator-admin + A + B) × 3 proposals.
    expect(assignments).toHaveLength(9);
    for (const proposal of proposals) {
      const reviewers = new Set(byProposal.get(proposal.id));
      expect(reviewers.has(reviewerA.profileId)).toBe(true);
      expect(reviewers.has(reviewerB.profileId)).toBe(true);
      expect(reviewers.size).toBe(3);
    }
  });
});

describe.concurrent('drift-path guards under single_reviewer', () => {
  it('backfillReviewAssignments skips and writes nothing', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance } = await createReviewInstance(
      testData,
      'single_reviewer',
      'all',
    );
    const reviewerRole = await createReviewerRole(instance.profileId);

    const [, lateReviewer] = await Promise.all([
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

    await Promise.all(
      Array.from({ length: 2 }, (_, i) =>
        testData.createProposal({
          userEmail: setup.userEmail,
          processInstanceId: instance.instance.id,
          proposalData: { title: `Proposal ${i}` },
          status: ProposalStatus.SUBMITTED,
        }),
      ),
    );

    await generate(instance.instance.id);
    const afterGeneration = await getAssignments(instance.instance.id);
    expect(afterGeneration).toHaveLength(2);

    // lateReviewer gains the REVIEW role mid-phase — under full coverage this
    // would backfill them onto every proposal.
    await testData.assignRole(
      lateReviewer.authUserId,
      instance.profileId,
      reviewerRole.id,
    );

    const result = await backfillReviewAssignments({
      instanceId: instance.instance.id,
      reviewerProfileIds: [lateReviewer.profileId],
    });

    expect(result).toEqual({
      skipped: 'current phase policy is single_reviewer',
    });

    const afterBackfill = await getAssignments(instance.instance.id);
    expect(afterBackfill.map((a) => a.id).sort()).toEqual(
      afterGeneration.map((a) => a.id).sort(),
    );
  });

  it('reconcileReviewAssignments skips and writes nothing, even under by_category', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instance } = await createReviewInstance(
      testData,
      'single_reviewer',
      'by_category',
    );
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
      reviewerProfileId: reviewerA.profileId,
    });

    await generate(instance.instance.id);
    const afterGeneration = await getAssignments(instance.instance.id);
    expect(afterGeneration).toHaveLength(1);

    // reviewerB is scoped to the same category mid-phase. Reconcile would
    // normally add them (its expected set is the full intersection) — the policy
    // guard has to win over the by_category scope check.
    await scopeReviewer({
      processInstanceId: instance.instance.id,
      taxonomyTermId: termA!.id,
      reviewerProfileId: reviewerB.profileId,
    });

    const result = await reconcileReviewAssignments({
      instanceId: instance.instance.id,
      affected: { taxonomyTermId: termA!.id },
    });

    expect(result).toEqual({
      skipped: 'current phase policy is single_reviewer',
    });

    const afterReconcile = await getAssignments(instance.instance.id);
    expect(afterReconcile.map((a) => a.id)).toEqual(
      afterGeneration.map((a) => a.id),
    );
  });
});
