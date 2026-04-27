import type { RubricTemplateSchema } from '@op/common';
import { OVERALL_RECOMMENDATION_KEY } from '@op/common/client';
import {
  ProposalReviewState,
  processInstances,
  proposalCategories,
  taxonomyTerms,
} from '@op/db/schema';
import { db } from '@op/db/test';
import { createProposalReview } from '@op/test';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { TestReviewsDataManager } from '../../../test/helpers/TestReviewsDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../../test/supabase-utils';
import { createCallerFactory } from '../../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

/**
 * Two-criterion rubric: `impact` (0–10, scored) and `feasibility` (1–5, scored),
 * plus the well-known overall-recommendation field (yes/no) — its answers feed
 * `overallRecommendationCount` but not `totalScore`.
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

/**
 * Phase scoping in the API defaults to `instance.currentStateId`. Test review
 * assignments are tagged `phaseId='review'` (the production default), so we
 * advance the instance into the review phase before exercising the API.
 */
async function advanceToReviewPhase(instanceId: string) {
  await db
    .update(processInstances)
    .set({ currentStateId: 'review' })
    .where(eq(processInstances.id, instanceId));
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

  it('rejects callers without admin access on the instance (hydration)', async ({
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

  it('returns aggregates for the requested proposalIds in hydration mode', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    await testData.setRubricTemplate(context, rubricTemplate);
    await advanceToReviewPhase(context.instance.instance.id);

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
      (i) => i.id === withReview.proposal.id,
    );
    expect(reviewedItem?.aggregates).toMatchObject({
      assignmentsTotal: 1,
      reviewsSubmitted: 1,
      totalScore: 11,
      averageScore: 11,
    });
    expect(reviewedItem?.aggregates.overallRecommendationCount).toEqual({
      yes: 1,
    });

    const unreviewedItem = result.items.find(
      (i) => i.id === withoutReview.proposal.id,
    );
    expect(unreviewedItem?.aggregates).toMatchObject({
      assignmentsTotal: 1,
      reviewsSubmitted: 0,
      totalScore: 0,
      averageScore: 0,
      overallRecommendationCount: {},
    });
    expect(unreviewedItem?.aggregates.reviewers).toHaveLength(1);
  });

  it('drops proposalIds belonging to a different instance in hydration mode', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);

    const [primary, foreign] = await Promise.all([
      testData.createReviewAssignment({ title: 'Primary' }),
      testData.createReviewAssignment({ title: 'Foreign' }),
    ]);

    await Promise.all([
      advanceToReviewPhase(primary.context.instance.instance.id),
      advanceToReviewPhase(foreign.context.instance.instance.id),
    ]);

    const adminCaller = await createAuthenticatedCaller(
      primary.context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.listWithReviewAggregates({
      processInstanceId: primary.context.instance.instance.id,
      proposalIds: [primary.proposal.id, foreign.proposal.id],
    });

    expect(result.items.map((i) => i.id)).toEqual([primary.proposal.id]);
  });

  it('sorts paginated results by totalScore desc across pages', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    await testData.setRubricTemplate(context, rubricTemplate);
    await advanceToReviewPhase(context.instance.instance.id);

    // Three proposals, one assignment each, with totals 3, 9, 6.
    const [low, high, mid] = await Promise.all([
      testData.createReviewAssignment({ context, title: 'Low' }),
      testData.createReviewAssignment({ context, title: 'High' }),
      testData.createReviewAssignment({ context, title: 'Mid' }),
    ]);

    await Promise.all([
      createProposalReview({
        assignmentId: low.assignment.id,
        state: ProposalReviewState.SUBMITTED,
        reviewData: { answers: { impact: 2, feasibility: 1 }, rationales: {} },
        submittedAt: new Date().toISOString(),
      }),
      createProposalReview({
        assignmentId: high.assignment.id,
        state: ProposalReviewState.SUBMITTED,
        reviewData: { answers: { impact: 5, feasibility: 4 }, rationales: {} },
        submittedAt: new Date().toISOString(),
      }),
      createProposalReview({
        assignmentId: mid.assignment.id,
        state: ProposalReviewState.SUBMITTED,
        reviewData: { answers: { impact: 3, feasibility: 3 }, rationales: {} },
        submittedAt: new Date().toISOString(),
      }),
    ]);

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const page1 = await adminCaller.decision.listWithReviewAggregates({
      processInstanceId: context.instance.instance.id,
      sortBy: 'totalScore',
      dir: 'desc',
      limit: 2,
    });

    expect(page1.total).toBe(3);
    expect(page1.items.map((i) => i.id)).toEqual([
      high.proposal.id,
      mid.proposal.id,
    ]);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await adminCaller.decision.listWithReviewAggregates({
      processInstanceId: context.instance.instance.id,
      sortBy: 'totalScore',
      dir: 'desc',
      limit: 2,
      cursor: page1.nextCursor!,
    });

    expect(page2.items.map((i) => i.id)).toEqual([low.proposal.id]);
    expect(page2.nextCursor).toBeNull();
  });

  it('filters paginated results by categoryId', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    await advanceToReviewPhase(context.instance.instance.id);

    const [tagged, untagged] = await Promise.all([
      testData.createReviewAssignment({ context, title: 'Tagged' }),
      testData.createReviewAssignment({ context, title: 'Untagged' }),
    ]);

    const term = await attachCategoryToProposal({
      proposalId: tagged.proposal.id,
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
      categoryId: term.id,
    });

    expect(result.items.map((i) => i.id)).toEqual([tagged.proposal.id]);
    expect(result.items[0]?.categories).toEqual([
      { id: term.id, label: 'Infrastructure', termUri: term.termUri },
    ]);
    expect(
      result.items.find((i) => i.id === untagged.proposal.id),
    ).toBeUndefined();
  });

  it('keeps proposals with zero submitted reviews and exposes their reviewer roster', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    await testData.setRubricTemplate(context, rubricTemplate);
    await advanceToReviewPhase(context.instance.instance.id);

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
      reviewsSubmitted: 0,
      totalScore: 0,
      averageScore: 0,
      overallRecommendationCount: {},
    });
    expect(result.items[0]?.aggregates.reviewers.length).toBeGreaterThan(0);
  });
});
