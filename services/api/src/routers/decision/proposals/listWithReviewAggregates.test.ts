import type { RubricTemplateSchema } from '@op/common';
import { OVERALL_RECOMMENDATION_KEY } from '@op/common/client';
import {
  ProposalReviewAssignmentStatus,
  ProposalReviewState,
  proposalCategories,
  proposals as proposalsTable,
  taxonomyTerms,
} from '@op/db/schema';
import { db } from '@op/db/test';
import { createProposalReview, createReviewAssignment } from '@op/test';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import { TestReviewsDataManager } from '../../../test/helpers/TestReviewsDataManager';
import {
  accessTierGatingCell,
  describeDecisionAccessTierGating,
  expectFailsAccessTierGate,
} from '../../../test/helpers/gating/decision';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../../test/supabase-utils';
import { createCallerFactory } from '../../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

/**
 * Two-criterion rubric: `impact` (0–10, scored) and `feasibility` (1–5, scored),
 * plus the well-known overall-recommendation field (yes/no) — its answers feed
 * `overallRecommendationCount` but not `averageScore`.
 */
const rubricTemplate: RubricTemplateSchema = {
  type: 'object',
  'x-field-order': ['impact', 'feasibility', OVERALL_RECOMMENDATION_KEY],
  properties: {
    impact: {
      type: 'integer',
      title: 'Impact',
      minimum: 0,
      maximum: 10,
    },
    feasibility: {
      type: 'integer',
      title: 'Feasibility',
      minimum: 1,
      maximum: 5,
    },
    [OVERALL_RECOMMENDATION_KEY]: {
      type: 'string',
      title: 'Recommendation',
      'x-format': 'dropdown',
      oneOf: [
        { const: 'yes', title: 'Yes' },
        { const: 'no', title: 'No' },
      ],
    },
  },
  required: ['impact'],
};

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

async function attachCategoryToProposal({
  proposalId,
  label,
}: {
  proposalId: string;
  label: string;
}) {
  const [term] = await db
    .insert(taxonomyTerms)
    .values({
      termUri: `${label.toLowerCase()}-${proposalId}`,
      label,
    })
    .returning();
  if (!term) {
    throw new Error('failed to create taxonomy term');
  }

  await db
    .insert(proposalCategories)
    .values({ proposalId, taxonomyTermId: term.id });

  return term;
}

describe.concurrent('listWithReviewAggregates', () => {
  it('rejects callers without admin access on the instance (paginated)', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    // Reviewer-role only — REVIEW capability, no ADMIN.
    const reviewer = await testData.createInstanceReviewerWithRole(context);

    const reviewerCaller = await createAuthenticatedCaller(reviewer.email);

    await expect(
      reviewerCaller.decision.listWithReviewAggregates({
        processInstanceId: context.instance.instance.id,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });

  it('rejects callers without admin access on the instance (filtered)', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment();
    const reviewer = await testData.createInstanceReviewerWithRole(
      created.context,
    );

    const reviewerCaller = await createAuthenticatedCaller(reviewer.email);

    await expect(
      reviewerCaller.decision.listWithReviewAggregates({
        processInstanceId: created.context.instance.instance.id,
        proposalIds: [created.proposal.id],
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });

  it('rejects proposalIds combined with paginated-mode filters', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment();

    const adminCaller = await createAuthenticatedCaller(
      created.context.defaultReviewer.email,
    );

    // Filtered mode owns its set and its order; the two modes stay exclusive so
    // a caller can't pass a sort or a cursor that would be silently ignored.
    await expect(
      adminCaller.decision.listWithReviewAggregates({
        processInstanceId: created.context.instance.instance.id,
        proposalIds: [created.proposal.id],
        sort: 'newest',
      }),
    ).rejects.toThrow();
  });

  it('returns aggregates for the requested proposalIds in filtered mode', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    await testData.setRubricTemplate(context, rubricTemplate);
    await testData.setCurrentPhase(context.instance.instance.id, 'review');

    // Two proposals, each with a single reviewer assigned. The first has a
    // submitted review; the second has none.
    const [withReview, withoutReview] = await Promise.all([
      testData.createReviewAssignment({
        context,
        title: 'Proposal With Review',
      }),
      testData.createReviewAssignment({
        context,
        title: 'Proposal Without Review',
      }),
    ]);

    await createProposalReview({
      assignmentId: withReview.assignment.id,
      state: ProposalReviewState.SUBMITTED,
      reviewData: {
        answers: {
          impact: 7,
          feasibility: 4,
          [OVERALL_RECOMMENDATION_KEY]: 'yes',
        },
        rationales: {},
      },
      submittedAt: new Date().toISOString(),
    });

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );
    const result = await adminCaller.decision.listWithReviewAggregates({
      processInstanceId: context.instance.instance.id,
      proposalIds: [withReview.proposal.id, withoutReview.proposal.id],
    });

    expect(result.items).toHaveLength(2);

    const reviewedItem = result.items.find(
      (i) => i.proposal.id === withReview.proposal.id,
    );
    expect(reviewedItem?.aggregates).toMatchObject({
      assignmentsCount: 1,
      reviewsSubmittedCount: 1,
      averageScore: 11,
    });
    expect(reviewedItem?.aggregates.overallRecommendationCount).toEqual({
      yes: 1,
    });

    const unreviewedItem = result.items.find(
      (i) => i.proposal.id === withoutReview.proposal.id,
    );
    expect(unreviewedItem?.aggregates).toMatchObject({
      assignmentsCount: 1,
      reviewsSubmittedCount: 0,
      averageScore: 0,
      overallRecommendationCount: {},
    });
    expect(unreviewedItem?.aggregates.reviewers).toHaveLength(1);
  });

  it('drops proposalIds belonging to a different instance in filtered mode', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);

    const [primary, foreign] = await Promise.all([
      testData.createReviewAssignment({ title: 'Primary' }),
      testData.createReviewAssignment({ title: 'Foreign' }),
    ]);

    await Promise.all([
      testData.setCurrentPhase(primary.context.instance.instance.id, 'review'),
      testData.setCurrentPhase(foreign.context.instance.instance.id, 'review'),
    ]);

    const adminCaller = await createAuthenticatedCaller(
      primary.context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.listWithReviewAggregates({
      processInstanceId: primary.context.instance.instance.id,
      proposalIds: [primary.proposal.id, foreign.proposal.id],
    });

    expect(result.items.map((i) => i.proposal.id)).toEqual([
      primary.proposal.id,
    ]);
  });

  it('drops soft-deleted proposalIds in filtered mode', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: 'Soft Deleted',
    });
    await testData.setCurrentPhase(
      created.context.instance.instance.id,
      'review',
    );

    await db
      .update(proposalsTable)
      .set({ deletedAt: new Date().toISOString() })
      .where(eq(proposalsTable.id, created.proposal.id));

    const adminCaller = await createAuthenticatedCaller(
      created.context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.listWithReviewAggregates({
      processInstanceId: created.context.instance.instance.id,
      proposalIds: [created.proposal.id],
    });

    expect(result.items).toEqual([]);
  });

  it('paginates by createdAt across pages', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    await testData.setCurrentPhase(context.instance.instance.id, 'review');

    const proposals = [];
    for (const title of ['First', 'Second', 'Third']) {
      proposals.push(await testData.createReviewAssignment({ context, title }));
    }

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const page1 = await adminCaller.decision.listWithReviewAggregates({
      processInstanceId: context.instance.instance.id,
      limit: 2,
      sort: 'newest',
    });

    expect(page1.total).toBe(3);
    expect(page1.items).toHaveLength(2);
    expect(page1.next).not.toBeNull();

    const page2 = await adminCaller.decision.listWithReviewAggregates({
      processInstanceId: context.instance.instance.id,
      limit: 2,
      sort: 'newest',
      cursor: page1.next!,
    });

    expect(page2.items).toHaveLength(1);
    expect(page2.next).toBeNull();

    // All three proposals appear exactly once across the two pages.
    const allIds = [...page1.items, ...page2.items]
      .map((i) => i.proposal.id)
      .sort();
    expect(allIds).toEqual(proposals.map((p) => p.proposal.id).sort());
  });

  it('attaches categories to response items', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    await testData.setCurrentPhase(context.instance.instance.id, 'review');

    const created = await testData.createReviewAssignment({
      context,
      title: 'Tagged',
    });

    const term = await attachCategoryToProposal({
      proposalId: created.proposal.id,
      label: 'Infrastructure',
    });
    // Taxonomy terms have no cascade from proposals/instances; clean up by
    // hand so the global deseed pass doesn't fail with a stray row.
    onTestFinished(async () => {
      await db.delete(taxonomyTerms).where(eq(taxonomyTerms.id, term.id));
    });

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.listWithReviewAggregates({
      processInstanceId: context.instance.instance.id,
    });

    const tagged = result.items.find(
      (i) => i.proposal.id === created.proposal.id,
    );
    expect(tagged?.categories).toEqual([
      { id: term.id, label: 'Infrastructure', termUri: term.termUri },
    ]);
  });

  it('keeps proposals with zero submitted reviews and exposes their reviewer roster', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    await testData.setRubricTemplate(context, rubricTemplate);
    await testData.setCurrentPhase(context.instance.instance.id, 'review');

    const created = await testData.createReviewAssignment({
      context,
      title: 'No Submissions Yet',
    });

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.listWithReviewAggregates({
      processInstanceId: context.instance.instance.id,
      proposalIds: [created.proposal.id],
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.aggregates).toMatchObject({
      reviewsSubmittedCount: 0,
      averageScore: 0,
      overallRecommendationCount: {},
    });
    expect(result.items[0]?.aggregates.reviewers.length).toBeGreaterThan(0);
  });

  it('derives the per-proposal reviewStatus rollup', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    await testData.setCurrentPhase(context.instance.instance.id, 'review');

    const [notStarted, started, drafted, reviewed] = await Promise.all([
      testData.createReviewAssignment({ context, title: 'Not Started' }),
      testData.createReviewAssignment({
        context,
        title: 'Started',
        status: ProposalReviewAssignmentStatus.IN_PROGRESS,
      }),
      testData.createReviewAssignment({ context, title: 'Drafted' }),
      testData.createReviewAssignment({
        context,
        title: 'Reviewed',
        status: ProposalReviewAssignmentStatus.COMPLETED,
      }),
    ]);

    // A saved draft counts as in progress even while the assignment is pending.
    await createProposalReview({
      assignmentId: drafted.assignment.id,
      state: ProposalReviewState.DRAFT,
    });

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.listWithReviewAggregates({
      processInstanceId: context.instance.instance.id,
    });

    const statusByProposalId = new Map(
      result.items.map((item) => [
        item.proposal.id,
        item.aggregates.reviewStatus,
      ]),
    );

    expect(statusByProposalId.get(notStarted.proposal.id)).toBe('not_started');
    expect(statusByProposalId.get(started.proposal.id)).toBe('in_progress');
    expect(statusByProposalId.get(drafted.proposal.id)).toBe('in_progress');
    expect(statusByProposalId.get(reviewed.proposal.id)).toBe('reviewed');
  });

  it('filters by reviewStatus in SQL so total matches the page', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    await testData.setCurrentPhase(context.instance.instance.id, 'review');

    const [notStarted, started, reviewed] = await Promise.all([
      testData.createReviewAssignment({ context, title: 'Not Started' }),
      testData.createReviewAssignment({
        context,
        title: 'Started',
        status: ProposalReviewAssignmentStatus.IN_PROGRESS,
      }),
      testData.createReviewAssignment({
        context,
        title: 'Reviewed',
        status: ProposalReviewAssignmentStatus.COMPLETED,
      }),
    ]);

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const expectations = [
      { reviewStatus: 'not_started' as const, expected: notStarted },
      { reviewStatus: 'in_progress' as const, expected: started },
      { reviewStatus: 'reviewed' as const, expected: reviewed },
    ];

    for (const { reviewStatus, expected } of expectations) {
      const result = await adminCaller.decision.listWithReviewAggregates({
        processInstanceId: context.instance.instance.id,
        reviewStatus,
      });

      expect(result.items.map((item) => item.proposal.id)).toEqual([
        expected.proposal.id,
      ]);
      // `total` comes from the same SQL predicate — a JS-side filter would
      // leave it at 3 and make the header disagree with the list.
      expect(result.total).toBe(1);
    }
  });

  it('filters by categoryIds', async ({ task, onTestFinished }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    await testData.setCurrentPhase(context.instance.instance.id, 'review');

    const [tagged] = await Promise.all([
      testData.createReviewAssignment({ context, title: 'Tagged' }),
      testData.createReviewAssignment({ context, title: 'Untagged' }),
    ]);

    const term = await attachCategoryToProposal({
      proposalId: tagged!.proposal.id,
      label: 'Housing',
    });
    onTestFinished(async () => {
      await db.delete(taxonomyTerms).where(eq(taxonomyTerms.id, term.id));
    });

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.listWithReviewAggregates({
      processInstanceId: context.instance.instance.id,
      categoryIds: [term.id],
    });

    expect(result.items.map((item) => item.proposal.id)).toEqual([
      tagged!.proposal.id,
    ]);
    expect(result.total).toBe(1);
  });

  it('sorts by fewest completed reviews and pages with a keyset cursor', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    await testData.setCurrentPhase(context.instance.instance.id, 'review');

    // Completed-review counts of 0, 1 and 2 — the leastReviewed order.
    const zeroCompleted = await testData.createReviewAssignment({
      context,
      title: 'Zero Completed',
    });
    const oneCompleted = await testData.createReviewAssignment({
      context,
      title: 'One Completed',
      status: ProposalReviewAssignmentStatus.COMPLETED,
    });
    const twoCompleted = await testData.createReviewAssignment({
      context,
      title: 'Two Completed',
      status: ProposalReviewAssignmentStatus.COMPLETED,
    });

    // The unique constraint is (instance, proposal, reviewer, phase), so the
    // second completed assignment needs a second reviewer.
    const secondReviewer = await testData.createReviewer(context);
    await createReviewAssignment({
      processInstanceId: context.instance.instance.id,
      proposalId: twoCompleted.proposal.id,
      reviewerProfileId: secondReviewer.profileId,
      phaseId: 'review',
      status: ProposalReviewAssignmentStatus.COMPLETED,
    });

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const page1 = await adminCaller.decision.listWithReviewAggregates({
      processInstanceId: context.instance.instance.id,
      limit: 2,
    });

    expect(page1.total).toBe(3);
    expect(page1.items.map((item) => item.proposal.id)).toEqual([
      zeroCompleted.proposal.id,
      oneCompleted.proposal.id,
    ]);
    expect(page1.next).not.toBeNull();

    const page2 = await adminCaller.decision.listWithReviewAggregates({
      processInstanceId: context.instance.instance.id,
      limit: 2,
      cursor: page1.next!,
    });

    // The keyset resumes on (completedCount, id) — no repeats, no gaps.
    expect(page2.items.map((item) => item.proposal.id)).toEqual([
      twoCompleted.proposal.id,
    ]);
    expect(page2.next).toBeNull();
  });

  it('sorts by newest and oldest creation date', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    await testData.setCurrentPhase(context.instance.instance.id, 'review');

    const created = [];
    for (const title of ['First', 'Second', 'Third']) {
      created.push(await testData.createReviewAssignment({ context, title }));
    }
    const creationOrder = created.map((item) => item.proposal.id);

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const [oldest, newest] = await Promise.all([
      adminCaller.decision.listWithReviewAggregates({
        processInstanceId: context.instance.instance.id,
        sort: 'oldest',
      }),
      adminCaller.decision.listWithReviewAggregates({
        processInstanceId: context.instance.instance.id,
        sort: 'newest',
      }),
    ]);

    expect(oldest.items.map((item) => item.proposal.id)).toEqual(creationOrder);
    expect(newest.items.map((item) => item.proposal.id)).toEqual(
      [...creationOrder].reverse(),
    );
  });
});

describeDecisionAccessTierGating('listWithReviewAggregates', {
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
        caller.decision.listWithReviewAggregates({
          processInstanceId: instance.instance.id,
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
        caller.decision.listWithReviewAggregates({
          processInstanceId: instance.instance.id,
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
        caller.decision.listWithReviewAggregates({
          processInstanceId: instance.instance.id,
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

      const result = await caller.decision.listWithReviewAggregates({
        processInstanceId: instance.instance.id,
      });

      expect(result.items).toBeDefined();
    },
  ),
});
