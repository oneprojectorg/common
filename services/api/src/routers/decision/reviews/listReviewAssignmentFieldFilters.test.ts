import type { RubricTemplateSchema } from '@op/common';
import {
  ProposalReviewAssignmentStatus,
  ProposalReviewState,
} from '@op/db/schema';
import { createProposalReview } from '@op/test';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { TestReviewsDataManager } from '../../../test/helpers/TestReviewsDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../../test/supabase-utils';
import { createCallerFactory } from '../../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

const PARKS = 'a1b2c3d4';
const TRANSPORT = 'e5f6a7b8';
const HEALTH = 'c9d0e1f2';

const RECOMMENDATION_KEY = '__overall_recommendation';

/**
 * The two filterable shapes plus one of each shape that must stay out: a
 * scored criterion (integer options) and a free-text one.
 */
const rubricTemplate: RubricTemplateSchema = {
  type: 'object',
  'x-field-order': [RECOMMENDATION_KEY, 'department', 'impact', 'notes'],
  properties: {
    [RECOMMENDATION_KEY]: {
      type: 'string',
      title: 'Overall recommendation',
      'x-format': 'dropdown',
      oneOf: [
        { const: 'yes', title: 'Yes' },
        { const: 'maybe', title: 'Maybe' },
        { const: 'no', title: 'No' },
      ],
    },
    // Nullable multi choice: the union `type` is the shape real templates use
    // for an optional field, and the array half decides the containment.
    department: {
      type: ['array', 'null'],
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

interface SeedAssignmentOptions {
  title: string;
  status?: ProposalReviewAssignmentStatus;
  /** Omit to leave the assignment without a review row. */
  answers?: Record<string, unknown>;
}

/**
 * One proposal assigned to the context's reviewer, optionally with a
 * submitted review carrying `answers`.
 */
async function seedAssignment(
  testData: TestReviewsDataManager,
  context: Awaited<ReturnType<TestReviewsDataManager['createContext']>>,
  opts: SeedAssignmentOptions,
) {
  const created = await testData.createReviewAssignment({
    context,
    title: opts.title,
    status: opts.status ?? ProposalReviewAssignmentStatus.COMPLETED,
  });

  if (opts.answers) {
    await createProposalReview({
      assignmentId: created.assignment.id,
      state: ProposalReviewState.SUBMITTED,
      reviewData: { answers: opts.answers, rationales: {} },
      submittedAt: new Date().toISOString(),
    });
  }

  return created;
}

/**
 * Four assignments: three answered across both criteria, one with no review
 * row at all.
 */
async function seedQueue(
  testId: string,
  onTestFinished: (fn: () => void | Promise<void>) => void,
) {
  const testData = new TestReviewsDataManager(testId, onTestFinished);
  const context = await testData.createContext();
  await testData.setRubricTemplate(context, rubricTemplate);

  await seedAssignment(testData, context, {
    title: `Yes + parks ${testId}`,
    answers: { [RECOMMENDATION_KEY]: 'yes', department: [PARKS], impact: 5 },
  });
  await seedAssignment(testData, context, {
    title: `Maybe + parks/health ${testId}`,
    answers: {
      [RECOMMENDATION_KEY]: 'maybe',
      department: [PARKS, HEALTH],
    },
  });
  // Pinned to a different status so a filter can be composed with it.
  await seedAssignment(testData, context, {
    title: `Yes + health, in progress ${testId}`,
    status: ProposalReviewAssignmentStatus.IN_PROGRESS,
    answers: { [RECOMMENDATION_KEY]: 'yes', department: [HEALTH] },
  });
  await seedAssignment(testData, context, {
    title: `Unreviewed ${testId}`,
    status: ProposalReviewAssignmentStatus.PENDING,
  });

  const caller = await createAuthenticatedCaller(context.defaultReviewer.email);

  return {
    caller,
    phaseRef: {
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
    },
  };
}

describe.concurrent('decision.listReviewAssignments fieldFilters', () => {
  it('filters the queue by review answers and composes with status', async ({
    task,
    onTestFinished,
  }) => {
    const { caller, phaseRef } = await seedQueue(task.id, onTestFinished);

    // ── No filter: every assignment, reviewed or not ──────────────────────
    const unfiltered = await caller.decision.listReviewAssignments({
      ...phaseRef,
      limit: 25,
    });
    expect(unfiltered.total).toBe(4);
    expect(
      unfiltered.assignments.filter((entry) => entry.review === null),
    ).toHaveLength(1);

    // ── ANY-OF within a key, and the unreviewed row drops out ─────────────
    const recommended = await caller.decision.listReviewAssignments({
      ...phaseRef,
      limit: 25,
      fieldFilters: { [RECOMMENDATION_KEY]: ['yes', 'maybe'] },
    });
    expect(recommended.total).toBe(3);
    // An assignment with no review row can never satisfy an answer filter.
    expect(
      recommended.assignments.every((entry) => entry.review !== null),
    ).toBe(true);

    const onlyYes = await caller.decision.listReviewAssignments({
      ...phaseRef,
      limit: 25,
      fieldFilters: { [RECOMMENDATION_KEY]: ['yes'] },
    });
    expect(onlyYes.total).toBe(2);

    // ── Composes with the existing status filter ──────────────────────────
    const yesAndCompleted = await caller.decision.listReviewAssignments({
      ...phaseRef,
      limit: 25,
      status: ProposalReviewAssignmentStatus.COMPLETED,
      fieldFilters: { [RECOMMENDATION_KEY]: ['yes'] },
    });
    expect(yesAndCompleted.total).toBe(1);
    expect(
      yesAndCompleted.assignments[0]?.assignment.proposal.profile.name,
    ).toBe(`Yes + parks ${task.id}`);

    // ── Multi-choice containment matches one element of the array ─────────
    const parks = await caller.decision.listReviewAssignments({
      ...phaseRef,
      limit: 25,
      fieldFilters: { department: [PARKS] },
    });
    expect(parks.total).toBe(2);

    // ── AND across keys ──────────────────────────────────────────────────
    const yesAndHealth = await caller.decision.listReviewAssignments({
      ...phaseRef,
      limit: 25,
      fieldFilters: { [RECOMMENDATION_KEY]: ['yes'], department: [HEALTH] },
    });
    expect(yesAndHealth.total).toBe(1);

    // ── Keys the rubric does not offer are ignored, not rejected ──────────
    const unknownKeys = await caller.decision.listReviewAssignments({
      ...phaseRef,
      limit: 25,
      fieldFilters: { impact: ['5'], notes: ['x'], nope: ['y'] },
    });
    expect(unknownKeys.total).toBe(4);
  });

  it('pages a filtered queue without losing the filter', async ({
    task,
    onTestFinished,
  }) => {
    const { caller, phaseRef } = await seedQueue(task.id, onTestFinished);

    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;

    do {
      const page = await caller.decision.listReviewAssignments({
        ...phaseRef,
        limit: 1,
        fieldFilters: { [RECOMMENDATION_KEY]: ['yes', 'maybe'] },
        ...(cursor ? { cursor } : {}),
      });

      expect(page.total).toBe(3);
      seen.push(...page.assignments.map((entry) => entry.assignment.id));
      cursor = page.next;
      pages += 1;
    } while (cursor && pages < 10);

    expect(seen).toHaveLength(3);
    expect(new Set(seen).size).toBe(3);
  });
});

describe.concurrent('decision.listReviewAssignmentFieldFacets', () => {
  it('counts every option over the reviewer queue', async ({
    task,
    onTestFinished,
  }) => {
    const { caller, phaseRef } = await seedQueue(task.id, onTestFinished);

    const facets =
      await caller.decision.listReviewAssignmentFieldFacets(phaseRef);

    expect(facets.total).toBe(4);
    // Scored and free-text criteria are not filterable, so not facets.
    expect(facets.facets.map((facet) => facet.key)).toEqual([
      RECOMMENDATION_KEY,
      'department',
    ]);
    expect(facets.facets.map((facet) => facet.kind)).toEqual([
      'single',
      'multi',
    ]);
    expect(facetCounts(facets.facets, RECOMMENDATION_KEY)).toEqual({
      yes: 2,
      maybe: 1,
      // Present at zero: an option nobody chose still has to be selectable.
      no: 0,
    });
    expect(facetCounts(facets.facets, 'department')).toEqual({
      [PARKS]: 2,
      [HEALTH]: 2,
      [TRANSPORT]: 0,
    });
  });

  it('counts each key over the set filtered by the other keys only', async ({
    task,
    onTestFinished,
  }) => {
    const { caller, phaseRef } = await seedQueue(task.id, onTestFinished);

    const facets = await caller.decision.listReviewAssignmentFieldFacets({
      ...phaseRef,
      fieldFilters: { [RECOMMENDATION_KEY]: ['yes'] },
    });

    // `total` is the filtered result count the list shows.
    expect(facets.total).toBe(2);
    // The filtered key ignores its own filter, so its other options stay
    // selectable with honest counts.
    expect(facetCounts(facets.facets, RECOMMENDATION_KEY)).toEqual({
      yes: 2,
      maybe: 1,
      no: 0,
    });
    // Every other key is counted over the filtered set: the two "yes"
    // reviews picked Parks and Public Health, one each.
    expect(facetCounts(facets.facets, 'department')).toEqual({
      [PARKS]: 1,
      [HEALTH]: 1,
      [TRANSPORT]: 0,
    });
  });

  it('counts over the same scope the list filters by', async ({
    task,
    onTestFinished,
  }) => {
    const { caller, phaseRef } = await seedQueue(task.id, onTestFinished);

    // A status filter narrows the population both reads describe.
    const facets = await caller.decision.listReviewAssignmentFieldFacets({
      ...phaseRef,
      status: ProposalReviewAssignmentStatus.COMPLETED,
    });
    const list = await caller.decision.listReviewAssignments({
      ...phaseRef,
      limit: 25,
      status: ProposalReviewAssignmentStatus.COMPLETED,
    });

    expect(facets.total).toBe(list.total);
    expect(facetCounts(facets.facets, RECOMMENDATION_KEY)).toEqual({
      yes: 1,
      maybe: 1,
      no: 0,
    });
  });

  it('returns the catalogue at zero when the queue is empty', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    await testData.setRubricTemplate(context, rubricTemplate);

    const caller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const facets = await caller.decision.listReviewAssignmentFieldFacets({
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
    });

    expect(facets.total).toBe(0);
    expect(facetCounts(facets.facets, RECOMMENDATION_KEY)).toEqual({
      yes: 0,
      maybe: 0,
      no: 0,
    });
  });

  it('rejects a caller with neither the review capability nor admin', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    const member = await testData.createInstanceMember(context);

    const memberCaller = await createAuthenticatedCaller(member.email);

    await expect(
      memberCaller.decision.listReviewAssignmentFieldFacets({
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
      caller.decision.listReviewAssignmentFieldFacets({
        processInstanceId: context.instance.instance.id,
        phaseId: 'this-phase-does-not-exist',
      }),
    ).rejects.toMatchObject({ cause: { name: 'NotFoundError' } });
  });
});
