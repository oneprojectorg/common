import type { RubricTemplateSchema } from '@op/common';
import { ProposalReviewState } from '@op/db/schema';
import { createProposalReview } from '@op/test';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
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

const PARKS = 'a1b2c3d4';
const TRANSPORT = 'e5f6a7b8';
const HEALTH = 'c9d0e1f2';

/**
 * One criterion of every shape the filter layer must tell apart: a single
 * choice, a multi choice, a scored criterion and a free-text one. Only the
 * first two are facetable, and the test asserts the other two stay out.
 */
const rubricTemplate: RubricTemplateSchema = {
  type: 'object',
  'x-field-order': ['department', 'departments', 'impact', 'notes'],
  properties: {
    department: {
      type: 'string',
      title: 'Lead department',
      'x-format': 'dropdown',
      oneOf: [
        { const: PARKS, title: 'Parks' },
        { const: TRANSPORT, title: 'Transportation' },
        { const: HEALTH, title: 'Public Health' },
      ],
    },
    departments: {
      type: 'array',
      title: 'Which departments would this fall under?',
      'x-format': 'dropdown',
      minItems: 1,
      items: {
        type: 'string',
        oneOf: [
          { const: PARKS, title: 'Parks' },
          { const: TRANSPORT, title: 'Transportation' },
          { const: HEALTH, title: 'Public Health' },
        ],
      },
    },
    impact: {
      type: 'integer',
      title: 'Impact',
      'x-format': 'dropdown',
      minimum: 1,
      maximum: 5,
      oneOf: [
        { const: 1, title: 'Low' },
        { const: 5, title: 'High' },
      ],
    },
    notes: {
      type: 'string',
      title: 'Notes',
      'x-format': 'long-text',
    },
  },
};

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

/** Option ids mapped to their count, for readable facet assertions. */
function facetCounts(
  facets: Array<{ key: string; options: Array<{ id: string; count: number }> }>,
  key: string,
): Record<string, number> {
  const facet = facets.find((entry) => entry.key === key);
  if (!facet) {
    throw new Error(
      `Expected a facet for ${key}, got ${facets.map((f) => f.key).join(', ')}`,
    );
  }
  return Object.fromEntries(
    facet.options.map((option) => [option.id, option.count]),
  );
}

interface SeedReviewOptions {
  title: string;
  answers: Record<string, unknown>;
  submittedAt?: string | null;
  state?: ProposalReviewState;
}

/** A proposal, an assignment on it, and the review recorded against it. */
async function seedReview(
  testData: TestReviewsDataManager,
  context: Awaited<ReturnType<TestReviewsDataManager['createContext']>>,
  opts: SeedReviewOptions,
) {
  const created = await testData.createReviewAssignment({
    context,
    title: opts.title,
  });

  const review = await createProposalReview({
    assignmentId: created.assignment.id,
    state: opts.state ?? ProposalReviewState.SUBMITTED,
    reviewData: { answers: opts.answers, rationales: {} },
    // `null` is a real value here (an unsubmitted draft), so the default
    // hangs off key presence rather than nullishness.
    submittedAt:
      'submittedAt' in opts ? opts.submittedAt : new Date().toISOString(),
  });

  return { ...created, review };
}

describe.concurrent('decision.listPhaseReviews', () => {
  it('filters by choice answers and counts every option in SQL', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    await testData.setRubricTemplate(context, rubricTemplate);

    // Four reviews spanning both criteria, including one that answered the
    // multi criterion not at all.
    await seedReview(testData, context, {
      title: `Parks + parks ${task.id}`,
      answers: { department: PARKS, departments: [PARKS], impact: 5 },
      submittedAt: '2026-01-04T00:00:00.000Z',
    });
    await seedReview(testData, context, {
      title: `Transport + parks/health ${task.id}`,
      answers: {
        department: TRANSPORT,
        departments: [PARKS, HEALTH],
        impact: 1,
      },
      submittedAt: '2026-01-03T00:00:00.000Z',
    });
    await seedReview(testData, context, {
      title: `Parks + health ${task.id}`,
      answers: { department: PARKS, departments: [HEALTH] },
      submittedAt: '2026-01-02T00:00:00.000Z',
    });
    await seedReview(testData, context, {
      title: `Health only ${task.id}`,
      answers: { department: HEALTH, notes: 'no departments picked' },
      submittedAt: '2026-01-01T00:00:00.000Z',
    });

    const caller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );
    const phaseRef = {
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
    };

    // ── Unfiltered: the catalogue, not just the options in use ────────────
    const unfiltered = await caller.decision.listPhaseReviews(phaseRef);

    expect(unfiltered.total).toBe(4);
    expect(unfiltered.items).toHaveLength(4);
    // `impact` is scored and `notes` free text, so neither is filterable.
    expect(unfiltered.facets.map((facet) => facet.key)).toEqual([
      'department',
      'departments',
    ]);
    expect(unfiltered.facets.map((facet) => facet.kind)).toEqual([
      'single',
      'multi',
    ]);
    expect(facetCounts(unfiltered.facets, 'department')).toEqual({
      [PARKS]: 2,
      [TRANSPORT]: 1,
      [HEALTH]: 1,
    });
    // A review counts once per option it selected.
    expect(facetCounts(unfiltered.facets, 'departments')).toEqual({
      [PARKS]: 2,
      [TRANSPORT]: 0,
      [HEALTH]: 2,
    });
    // Newest first. Timestamps come back in the driver's text form, so the
    // order is asserted through the titles seeded against each one.
    expect(unfiltered.items.map((item) => item.proposalTitle)).toEqual([
      `Parks + parks ${task.id}`,
      `Transport + parks/health ${task.id}`,
      `Parks + health ${task.id}`,
      `Health only ${task.id}`,
    ]);
    // Joined context the caller would otherwise fetch per row.
    expect(unfiltered.items[0]?.proposalTitle).toBe(`Parks + parks ${task.id}`);
    expect(unfiltered.items[0]?.reviewerProfileId).toBe(
      context.defaultReviewer.profileId,
    );
    expect(unfiltered.items[0]?.reviewerName).not.toBeNull();
    expect(unfiltered.items[0]?.answers).toMatchObject({
      department: PARKS,
      departments: [PARKS],
    });

    // ── ANY-OF within one key ─────────────────────────────────────────────
    const anyOf = await caller.decision.listPhaseReviews({
      ...phaseRef,
      filters: { department: [PARKS, TRANSPORT] },
    });

    expect(anyOf.total).toBe(3);
    // The facet for the key being filtered ignores its own filter, so its
    // unselected options stay selectable.
    expect(facetCounts(anyOf.facets, 'department')).toEqual({
      [PARKS]: 2,
      [TRANSPORT]: 1,
      [HEALTH]: 1,
    });
    // Every other facet is counted over the filtered set.
    expect(facetCounts(anyOf.facets, 'departments')).toEqual({
      [PARKS]: 2,
      [TRANSPORT]: 0,
      [HEALTH]: 2,
    });

    // ── AND across keys, and multi-choice containment ─────────────────────
    const both = await caller.decision.listPhaseReviews({
      ...phaseRef,
      filters: { department: [PARKS], departments: [HEALTH] },
    });

    expect(both.total).toBe(1);
    expect(both.items.map((item) => item.proposalTitle)).toEqual([
      `Parks + health ${task.id}`,
    ]);
    // `department` counted over "departments contains health" only.
    expect(facetCounts(both.facets, 'department')).toEqual({
      [PARKS]: 1,
      [TRANSPORT]: 1,
      [HEALTH]: 0,
    });
    // `departments` counted over "department = parks" only.
    expect(facetCounts(both.facets, 'departments')).toEqual({
      [PARKS]: 1,
      [TRANSPORT]: 0,
      [HEALTH]: 1,
    });

    // ── Containment matches one element of a multi answer ─────────────────
    const multiOnly = await caller.decision.listPhaseReviews({
      ...phaseRef,
      filters: { departments: [PARKS] },
    });

    expect(multiOnly.total).toBe(2);
    expect(multiOnly.items.map((item) => item.proposalTitle).sort()).toEqual(
      [
        `Parks + parks ${task.id}`,
        `Transport + parks/health ${task.id}`,
      ].sort(),
    );

    // ── A key the rubric does not offer is ignored, not rejected ──────────
    const unknownKey = await caller.decision.listPhaseReviews({
      ...phaseRef,
      filters: { impact: ['5'], notFromThisRubric: [PARKS] },
    });

    expect(unknownKey.total).toBe(4);
  });

  it('pages by submitted_at with the review id as the tiebreaker', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    await testData.setRubricTemplate(context, rubricTemplate);

    // Two rows share a timestamp, so the page boundary can only hold if the
    // id tiebreaker is part of both the ORDER BY and the cursor.
    const submittedAts = [
      '2026-02-03T00:00:00.000Z',
      '2026-02-02T00:00:00.000Z',
      '2026-02-02T00:00:00.000Z',
      '2026-02-01T00:00:00.000Z',
    ];
    for (const [index, submittedAt] of submittedAts.entries()) {
      await seedReview(testData, context, {
        title: `Paged ${index} ${task.id}`,
        answers: { department: PARKS },
        submittedAt,
      });
    }

    const caller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );
    const phaseRef = {
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
    };

    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;

    do {
      const page = await caller.decision.listPhaseReviews({
        ...phaseRef,
        limit: 2,
        ...(cursor ? { cursor } : {}),
      });

      // `total` describes the whole result set, not the page.
      expect(page.total).toBe(4);
      expect(page.items.length).toBeLessThanOrEqual(2);
      seen.push(...page.items.map((item) => item.reviewId));
      cursor = page.nextCursor;
      pages += 1;
    } while (cursor && pages < 10);

    expect(pages).toBe(2);
    expect(seen).toHaveLength(4);
    expect(new Set(seen).size).toBe(4);
  });

  it('lists submitted reviews by default and drafts only on request', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    await testData.setRubricTemplate(context, rubricTemplate);

    await seedReview(testData, context, {
      title: `Submitted ${task.id}`,
      answers: { department: PARKS },
      submittedAt: '2026-03-02T00:00:00.000Z',
    });
    await seedReview(testData, context, {
      title: `Draft ${task.id}`,
      answers: { department: TRANSPORT },
      state: ProposalReviewState.DRAFT,
      submittedAt: null,
    });

    const caller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );
    const phaseRef = {
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
    };

    const submitted = await caller.decision.listPhaseReviews(phaseRef);
    expect(submitted.total).toBe(1);
    expect(facetCounts(submitted.facets, 'department')).toEqual({
      [PARKS]: 1,
      [TRANSPORT]: 0,
      [HEALTH]: 0,
    });

    const drafts = await caller.decision.listPhaseReviews({
      ...phaseRef,
      state: 'draft',
    });
    expect(drafts.total).toBe(1);
    expect(drafts.items[0]?.submittedAt).toBeNull();

    const all = await caller.decision.listPhaseReviews({
      ...phaseRef,
      state: 'all',
    });
    expect(all.total).toBe(2);
    // A draft has no submitted_at, and NULLs must sort last on a newest-first
    // list rather than leading it.
    expect(all.items.map((item) => item.proposalTitle)).toEqual([
      `Submitted ${task.id}`,
      `Draft ${task.id}`,
    ]);
    expect(all.items[1]?.submittedAt).toBeNull();
    expect(facetCounts(all.facets, 'department')).toEqual({
      [PARKS]: 1,
      [TRANSPORT]: 1,
      [HEALTH]: 0,
    });
  });

  it('returns no facets when the phase has no rubric', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();

    const caller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const result = await caller.decision.listPhaseReviews({
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
    });

    expect(result.facets).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.nextCursor).toBeNull();
  });

  it('rejects a reviewer who is not an instance admin', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    const reviewer = await testData.createInstanceReviewerWithRole(context);

    const reviewerCaller = await createAuthenticatedCaller(reviewer.email);

    await expect(
      reviewerCaller.decision.listPhaseReviews({
        processInstanceId: context.instance.instance.id,
        phaseId: 'review',
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });

  it('rejects a plain instance member', async ({ task, onTestFinished }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    const member = await testData.createInstanceMember(context);

    const memberCaller = await createAuthenticatedCaller(member.email);

    await expect(
      memberCaller.decision.listPhaseReviews({
        processInstanceId: context.instance.instance.id,
        phaseId: 'review',
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });

  it('rejects a phaseId that does not exist on the instance', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();

    const caller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    await expect(
      caller.decision.listPhaseReviews({
        processInstanceId: context.instance.instance.id,
        phaseId: 'this-phase-does-not-exist',
      }),
    ).rejects.toMatchObject({ cause: { name: 'NotFoundError' } });
  });

  it('rejects a cursor that did not come from a previous page', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();

    const caller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    await expect(
      caller.decision.listPhaseReviews({
        processInstanceId: context.instance.instance.id,
        phaseId: 'review',
        cursor: 'not-a-cursor',
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });
  });
});

describeDecisionAccessTierGating('decision.listPhaseReviews', {
  noJwtNonPublic: accessTierGatingCell(
    'rejects no-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestReviewsDataManager(task.id, onTestFinished);
      const context = await testData.createContext();

      const caller = await callers.noJwt();

      await expectFailsAccessTierGate(
        caller.decision.listPhaseReviews({
          processInstanceId: context.instance.instance.id,
          phaseId: 'review',
        }),
        'none',
      );
    },
  ),

  anonJwtNonPublic: accessTierGatingCell(
    'rejects anon-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestReviewsDataManager(task.id, onTestFinished);
      const context = await testData.createContext();

      const caller = await callers.anonJwt();

      await expectFailsAccessTierGate(
        caller.decision.listPhaseReviews({
          processInstanceId: context.instance.instance.id,
          phaseId: 'review',
        }),
        'anon',
      );
    },
  ),

  userJwtNonPublic: accessTierGatingCell(
    'rejects user-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestReviewsDataManager(task.id, onTestFinished);
      const context = await testData.createContext();

      const caller = await callers.userJwt();

      await expectFailsAccessTierGate(
        caller.decision.listPhaseReviews({
          processInstanceId: context.instance.instance.id,
          phaseId: 'review',
        }),
        'user',
      );
    },
  ),

  networkJwtNonPublic: accessTierGatingCell(
    'admits network-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestReviewsDataManager(task.id, onTestFinished);
      const context = await testData.createContext();

      const caller = await callers.networkJwt(context.defaultReviewer.email);

      // The admin: assert it lands, since "not Unauthorized" would also pass
      // if the procedure never ran.
      const result = await caller.decision.listPhaseReviews({
        processInstanceId: context.instance.instance.id,
        phaseId: 'review',
      });

      expect(result.total).toBe(0);
      expect(result.items).toEqual([]);
    },
  ),
});
