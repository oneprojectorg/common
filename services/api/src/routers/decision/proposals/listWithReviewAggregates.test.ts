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
import { createProposalReview } from '@op/test';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import { TestReviewsDataManager } from '../../../test/helpers/TestReviewsDataManager';
import { createGatingCallers } from '../../../test/helpers/gating/callers';
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
  it('rejects callers without admin access on the instance (phase-scoped)', async ({
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

  it('rejects a reviewer who does not name a phase (filtered)', async ({
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

  it('rejects an invalid filtered read instead of returning the whole phase', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: 'Strict Branch',
    });
    await testData.setCurrentPhase(
      created.context.instance.instance.id,
      'review',
    );

    const adminCaller = await createAuthenticatedCaller(
      created.context.defaultReviewer.email,
    );

    // An empty array fails the filtered branch. Without the strict phase-scoped
    // branch it would fall through with `proposalIds` stripped, handing a
    // caller who asked for nothing every proposal in the phase.
    await expect(
      adminCaller.decision.listWithReviewAggregates({
        processInstanceId: created.context.instance.instance.id,
        proposalIds: [],
      }),
    ).rejects.toThrow();
  });

  it('returns every proposal in the phase, past the old 50 cap', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    await testData.setCurrentPhase(context.instance.instance.id, 'review');

    // 51 > the 50-row default the deleted paginated branch capped this at.
    const created = [];
    for (let i = 0; i < 51; i++) {
      created.push(
        await testData.createReviewAssignment({
          context,
          title: `Proposal ${i}`,
        }),
      );
    }

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.listWithReviewAggregates({
      processInstanceId: context.instance.instance.id,
    });

    expect(result.items).toHaveLength(created.length);
    expect(result.items.map((i) => i.proposal.id).sort()).toEqual(
      created.map((p) => p.proposal.id).sort(),
    );

    const createdAts = result.items.map((i) => i.proposal.createdAt ?? '');
    expect(createdAts).toEqual([...createdAts].sort().reverse());
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
});

/**
 * Filtered mode is gated on `canReadPhaseReviews`: reviewers need a named
 * `openReviews` phase, admins need nothing. Phase-scoped mode stays admin-only.
 */
describe.concurrent('listWithReviewAggregates: openReviews gate', () => {
  /** A phase-`review` proposal carrying one COMPLETED assignment + submitted review. */
  async function createReviewedProposal(testData: TestReviewsDataManager) {
    const context = await testData.createContext();
    await testData.setCurrentPhase(context.instance.instance.id, 'review');

    const created = await testData.createReviewAssignment({
      context,
      title: 'Reviewed Proposal',
      status: ProposalReviewAssignmentStatus.COMPLETED,
    });
    await createProposalReview({
      assignmentId: created.assignment.id,
      state: ProposalReviewState.SUBMITTED,
      reviewData: { answers: { impact: 5 }, rationales: {} },
      submittedAt: new Date().toISOString(),
    });

    return { context, proposal: created.proposal };
  }

  it('returns counts to a reviewer on an openReviews phase', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const { context, proposal } = await createReviewedProposal(testData);
    await testData.setPhaseOpenReviews(
      context.instance.instance.id,
      'review',
      true,
    );

    // A process reviewer who holds REVIEW but not ADMIN, and who is not
    // assigned to this proposal — the "Other proposals" tab's viewer.
    const reviewer = await testData.createInstanceReviewerWithRole(context);
    const reviewerCaller = await createAuthenticatedCaller(reviewer.email);

    const result = await reviewerCaller.decision.listWithReviewAggregates({
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
      proposalIds: [proposal.id],
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.aggregates).toMatchObject({
      assignmentsCount: 1,
      reviewsSubmittedCount: 1,
    });
    // One COMPLETED assignment — the "N Reviewed" count the card renders.
    expect(
      result.items[0]?.aggregates.reviewers.filter(
        (r) => r.status === ProposalReviewAssignmentStatus.COMPLETED,
      ),
    ).toHaveLength(1);
  });

  it('rejects a reviewer when the named phase is not open', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const { context, proposal } = await createReviewedProposal(testData);
    await testData.setPhaseOpenReviews(
      context.instance.instance.id,
      'review',
      false,
    );

    const reviewer = await testData.createInstanceReviewerWithRole(context);
    const reviewerCaller = await createAuthenticatedCaller(reviewer.email);

    await expect(
      reviewerCaller.decision.listWithReviewAggregates({
        processInstanceId: context.instance.instance.id,
        phaseId: 'review',
        proposalIds: [proposal.id],
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });

  it('rejects a reviewer without the review capability on an open phase', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const { context, proposal } = await createReviewedProposal(testData);
    await testData.setPhaseOpenReviews(
      context.instance.instance.id,
      'review',
      true,
    );

    // READ only — openReviews widens the reviewer grant, not the member one.
    const member = await testData.createInstanceMember(context);
    const memberCaller = await createAuthenticatedCaller(member.email);

    await expect(
      memberCaller.decision.listWithReviewAggregates({
        processInstanceId: context.instance.instance.id,
        phaseId: 'review',
        proposalIds: [proposal.id],
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });

  it('keeps the phase-scoped mode admin-only for a reviewer on an open phase', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const { context } = await createReviewedProposal(testData);
    await testData.setPhaseOpenReviews(
      context.instance.instance.id,
      'review',
      true,
    );

    const reviewer = await testData.createInstanceReviewerWithRole(context);
    const reviewerCaller = await createAuthenticatedCaller(reviewer.email);

    await expect(
      reviewerCaller.decision.listWithReviewAggregates({
        processInstanceId: context.instance.instance.id,
        phaseId: 'review',
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });

  it('admits an admin in filtered mode with openReviews off and no phaseId', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const { context, proposal } = await createReviewedProposal(testData);
    await testData.setPhaseOpenReviews(
      context.instance.instance.id,
      'review',
      false,
    );

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.listWithReviewAggregates({
      processInstanceId: context.instance.instance.id,
      proposalIds: [proposal.id],
    });

    expect(result.items.map((item) => item.proposal.id)).toEqual([proposal.id]);
  });

  it('rejects an anonymous caller in filtered mode', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const { context, proposal } = await createReviewedProposal(testData);
    await testData.setPhaseOpenReviews(
      context.instance.instance.id,
      'review',
      true,
    );

    const callers = createGatingCallers(onTestFinished);
    const anonCaller = await callers.anonJwt();

    await expectFailsAccessTierGate(
      anonCaller.decision.listWithReviewAggregates({
        processInstanceId: context.instance.instance.id,
        phaseId: 'review',
        proposalIds: [proposal.id],
      }),
      'anon',
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
