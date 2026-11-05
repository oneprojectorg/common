import {
  type PhaseReviewerSummaries,
  type PhaseReviewerSummariesInput,
  type PhaseReviewerSummary,
  type ReviewerSort,
  type ReviewerStatus,
  reviewerStatusSchema,
} from '@op/common/client';
import {
  createProposalReview,
  TestReviewsDataManager,
} from '@op/common/testing';
import { db, eq } from '@op/db/client';
import {
  ProposalReviewAssignmentStatus,
  ProposalReviewState,
  profiles,
} from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
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

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

describe.concurrent('decision.listPhaseReviewerSummaries', () => {
  it('aggregates assigned, submitted and draft counts and the last submission', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const submitted = await testData.createReviewAssignment({
      title: `Submitted proposal ${task.id}`,
      status: ProposalReviewAssignmentStatus.COMPLETED,
    });
    const context = submitted.context;
    const drafted = await testData.createReviewAssignment({
      context,
      title: `Drafted proposal ${task.id}`,
      status: ProposalReviewAssignmentStatus.IN_PROGRESS,
    });
    await testData.setCurrentPhase(context.instance.instance.id, 'review');

    const submittedAt = new Date().toISOString();
    await createProposalReview({
      assignmentId: submitted.assignment.id,
      state: ProposalReviewState.SUBMITTED,
      reviewData: { answers: {}, rationales: {} },
      submittedAt,
    });
    await createProposalReview({
      assignmentId: drafted.assignment.id,
      state: ProposalReviewState.DRAFT,
      reviewData: { answers: {}, rationales: {} },
    });

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.listPhaseReviewerSummaries({
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
    });

    expect(result.totalAssignments).toBe(2);
    const summary = result.items.find(
      (candidate) =>
        candidate.reviewer.id === context.defaultReviewer.profileId,
    );
    expect(summary?.assignedCount).toBe(2);
    expect(summary?.submittedCount).toBe(1);
    expect(summary?.draftCount).toBe(1);
    expect(summary?.openCount).toBe(1);
    expect(summary?.lastSubmittedAt).not.toBeNull();
  });

  it('does not count a submitted review whose assignment awaits a re-review', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const reReview = await testData.createReviewAssignment({
      title: `Re-review proposal ${task.id}`,
      status: ProposalReviewAssignmentStatus.READY_FOR_RE_REVIEW,
    });
    const context = reReview.context;
    await testData.setCurrentPhase(context.instance.instance.id, 'review');

    await createProposalReview({
      assignmentId: reReview.assignment.id,
      state: ProposalReviewState.SUBMITTED,
      reviewData: { answers: {}, rationales: {} },
      submittedAt: new Date().toISOString(),
    });

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.listPhaseReviewerSummaries({
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
    });

    const summary = result.items.find(
      (candidate) =>
        candidate.reviewer.id === context.defaultReviewer.profileId,
    );
    expect(summary?.assignedCount).toBe(1);
    expect(summary?.submittedCount).toBe(0);
    expect(summary?.lastSubmittedAt).not.toBeNull();
  });

  it('pages every sort in order, without repeats or gaps', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const { context, reviewers } = await seedSortedReviewers(testData, task.id);
    const { half, full, third, zeroLow, zeroHigh, idle } = reviewers;

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );
    const input = {
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
    };
    const seededIds = Object.values(reviewers);

    const cases: { sort: ReviewerSort; expected: string[] }[] = [
      {
        sort: 'leastComplete',
        expected: [zeroLow, zeroHigh, third, half, full, idle],
      },
      {
        sort: 'mostComplete',
        expected: [full, half, third, zeroLow, zeroHigh, idle],
      },
      {
        sort: 'recentActivity',
        // Only `third` and `full` have a submitted review; the rest tie on
        // null and fall back to id.
        expected: [third, full, ...[half, zeroLow, zeroHigh, idle].sort()],
      },
      {
        sort: 'name',
        // `zeroLow` and `zeroHigh` share a name, so id breaks the tie.
        expected: [full, half, zeroLow, zeroHigh, third, idle],
      },
    ];

    for (const { sort, expected } of cases) {
      const [walked, unpaged] = await Promise.all([
        walkAllPages({ caller: adminCaller, input: { ...input, sort } }),
        adminCaller.decision.listPhaseReviewerSummaries({
          ...input,
          sort,
          limit: 100,
        }),
      ]);
      const walkedIds = walked.map((row) => row.reviewer.id);

      expect(walkedIds, sort).toEqual(
        unpaged.items.map((row) => row.reviewer.id),
      );
      expect(new Set(walkedIds).size, sort).toBe(walkedIds.length);
      expect(walkedIds.length, sort).toBe(unpaged.total);
      expect(
        walkedIds.filter((id) => seededIds.includes(id)),
        sort,
      ).toEqual(expected);
    }
  });

  it('keeps paging when a page ends on a ratio of 0 or a repeating fraction', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const { context, reviewers } = await seedSortedReviewers(testData, task.id);

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );
    const input = {
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
      sort: 'leastComplete' as const,
    };

    const firstPage = await adminCaller.decision.listPhaseReviewerSummaries({
      ...input,
      limit: 1,
    });
    expect(firstPage.items.map((row) => row.reviewer.id)).toEqual([
      reviewers.zeroLow,
    ]);
    expect(firstPage.next).not.toBeNull();

    const secondPage = await adminCaller.decision.listPhaseReviewerSummaries({
      ...input,
      limit: 1,
      cursor: firstPage.next,
    });
    expect(secondPage.items.map((row) => row.reviewer.id)).toEqual([
      reviewers.zeroHigh,
    ]);

    const pageOfTwo = await adminCaller.decision.listPhaseReviewerSummaries({
      ...input,
      limit: 2,
    });
    const afterZero = await adminCaller.decision.listPhaseReviewerSummaries({
      ...input,
      limit: 2,
      cursor: pageOfTwo.next,
    });
    expect(afterZero.items[0]?.reviewer.id).toBe(reviewers.third);

    // A page of three ends on `third` at 1/3, which no decimal holds exactly.
    const pageOfThree = await adminCaller.decision.listPhaseReviewerSummaries({
      ...input,
      limit: 3,
    });
    const afterThird = await adminCaller.decision.listPhaseReviewerSummaries({
      ...input,
      limit: 3,
      cursor: pageOfThree.next,
    });
    expect(pageOfThree.items.at(-1)?.reviewer.id).toBe(reviewers.third);
    expect(afterThird.items[0]?.reviewer.id).toBe(reviewers.half);
  });

  it('breaks a completion tie by the larger assignment count, then by id', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const { context, reviewers } = await seedCompletionTies(testData, task.id);
    const {
      zeroMany,
      zeroFewLow,
      zeroFewHigh,
      partMany,
      partFew,
      fullMany,
      fullFew,
      idle,
    } = reviewers;

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );
    const input = {
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
    };
    const seededIds = Object.values(reviewers);

    const cases: { sort: ReviewerSort; expected: string[] }[] = [
      {
        sort: 'leastComplete',
        expected: [
          zeroMany,
          zeroFewLow,
          zeroFewHigh,
          partMany,
          partFew,
          fullMany,
          fullFew,
          idle,
        ],
      },
      {
        sort: 'mostComplete',
        expected: [
          fullMany,
          fullFew,
          partMany,
          partFew,
          zeroMany,
          zeroFewLow,
          zeroFewHigh,
          idle,
        ],
      },
    ];

    for (const { sort, expected } of cases) {
      const unpaged = await adminCaller.decision.listPhaseReviewerSummaries({
        ...input,
        sort,
        limit: 100,
      });
      const unpagedIds = unpaged.items.map((row) => row.reviewer.id);
      expect(
        unpagedIds.filter((id) => seededIds.includes(id)),
        sort,
      ).toEqual(expected);

      // Every page size puts a page boundary inside the run of
      // `zeroFewLow` and `zeroFewHigh`, which tie on ratio and count.
      for (const limit of [1, 2, 3]) {
        const walked = await walkAllPages({
          caller: adminCaller,
          input: { ...input, sort },
          limit,
        });
        expect(
          walked.map((row) => row.reviewer.id),
          `${sort} limit ${limit}`,
        ).toEqual(unpagedIds);
      }
    }
  });

  it('rejects a cursor whose sort key is malformed', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );
    const id = context.defaultReviewer.profileId;
    const cases = [
      { sort: 'leastComplete', submittedCount: 'abc', assignedCount: 1, id },
      { sort: 'mostComplete', submittedCount: 1, assignedCount: -1, id },
    ] as const;

    for (const cursor of cases) {
      await expect(
        adminCaller.decision.listPhaseReviewerSummaries({
          processInstanceId: context.instance.instance.id,
          phaseId: 'review',
          sort: cursor.sort,
          cursor: Buffer.from(JSON.stringify(cursor)).toString('base64'),
        }),
        JSON.stringify(cursor),
      ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });
    }
  });

  it('rejects a cursor from another sort', async ({ task, onTestFinished }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const { context } = await seedSortedReviewers(testData, task.id);

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );
    const input = {
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
    };
    const firstPage = await adminCaller.decision.listPhaseReviewerSummaries({
      ...input,
      limit: 1,
    });

    await expect(
      adminCaller.decision.listPhaseReviewerSummaries({
        ...input,
        sort: 'name',
        limit: 1,
        cursor: firstPage.next,
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });
  });

  it('returns each reviewer status and filters on it, with a filtered total beside the phase-wide one', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const seeded = await seedReviewerStatuses(testData, task.id);
    const { context, profileIdByStatus } = seeded;

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );
    const unfiltered = await adminCaller.decision.listPhaseReviewerSummaries({
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
    });

    for (const [status, profileId] of Object.entries(profileIdByStatus)) {
      expect(
        unfiltered.items.find((row) => row.reviewer.id === profileId)?.status,
      ).toBe(status);
    }
    expect(unfiltered.total).toBe(unfiltered.totalReviewers);

    for (const status of reviewerStatusSchema.options) {
      const filtered = await adminCaller.decision.listPhaseReviewerSummaries({
        processInstanceId: context.instance.instance.id,
        phaseId: 'review',
        status,
      });

      expect(filtered.items.map((row) => row.status)).toEqual(
        filtered.items.map(() => status),
      );
      expect(filtered.items.map((row) => row.reviewer.id)).toContain(
        profileIdByStatus[status],
      );
      expect(filtered.total).toBe(filtered.items.length);
      expect(filtered.totalReviewers).toBe(unfiltered.totalReviewers);
      expect(filtered.totalAssignments).toBe(unfiltered.totalAssignments);
      expect(filtered.total).toBeLessThan(filtered.totalReviewers);
    }
  });

  it('pages the not-started filter under the least-complete sort through a run of equal keys', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const first = await testData.createReviewAssignment({
      title: `Pending sort proposal ${task.id}`,
      status: ProposalReviewAssignmentStatus.PENDING,
    });
    const context = first.context;
    const pendingIds = [context.defaultReviewer.profileId];
    for (const index of [0, 1, 2, 3]) {
      const member = await testData.createInstanceMember(context);
      await testData.createReviewAssignment({
        context,
        reviewer: member,
        title: `Pending sort proposal ${index} ${task.id}`,
        status: ProposalReviewAssignmentStatus.PENDING,
      });
      pendingIds.push(member.profileId);
    }

    const completedReviewer = await testData.createInstanceMember(context);
    const completed = await testData.createReviewAssignment({
      context,
      reviewer: completedReviewer,
      title: `Pending sort proposal completed ${task.id}`,
      status: ProposalReviewAssignmentStatus.COMPLETED,
    });
    const draftReviewer = await testData.createInstanceMember(context);
    const drafted = await testData.createReviewAssignment({
      context,
      reviewer: draftReviewer,
      title: `Pending sort proposal drafted ${task.id}`,
      status: ProposalReviewAssignmentStatus.IN_PROGRESS,
    });
    await testData.createInstanceReviewerWithRole(context);
    await testData.setCurrentPhase(context.instance.instance.id, 'review');

    await createProposalReview({
      assignmentId: completed.assignment.id,
      state: ProposalReviewState.SUBMITTED,
      reviewData: { answers: {}, rationales: {} },
      submittedAt: new Date().toISOString(),
    });
    await createProposalReview({
      assignmentId: drafted.assignment.id,
      state: ProposalReviewState.DRAFT,
      reviewData: { answers: {}, rationales: {} },
    });

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );
    const input = {
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
    };
    const filtered: Omit<PhaseReviewerSummariesInput, 'cursor' | 'limit'> = {
      ...input,
      status: ProposalReviewAssignmentStatus.PENDING,
      sort: 'leastComplete',
    };
    const [rows, firstPage, unfiltered] = await Promise.all([
      walkAllPages({ caller: adminCaller, input: filtered }),
      adminCaller.decision.listPhaseReviewerSummaries({
        ...filtered,
        limit: 2,
      }),
      adminCaller.decision.listPhaseReviewerSummaries(input),
    ]);
    const rowIds = rows.map((row) => row.reviewer.id);

    // Every row has a completion ratio of 0, so only the id orders them and
    // each cursor resumes inside the run of equal keys.
    expect(firstPage.next).not.toBeNull();
    expect(rows.map((row) => row.status)).toEqual(
      rows.map(() => ProposalReviewAssignmentStatus.PENDING),
    );
    expect(rowIds).toEqual([...pendingIds].sort());
    expect(new Set(rowIds).size).toBe(rowIds.length);
    expect(firstPage.total).toBe(pendingIds.length);
    expect(firstPage.totalReviewers).toBe(unfiltered.totalReviewers);
    expect(firstPage.totalReviewers).toBeGreaterThan(firstPage.total);
  });

  it('pages a search under the name sort, with only matching rows', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const first = await testData.createReviewAssignment({
      title: `Search sort proposal ${task.id}`,
      status: ProposalReviewAssignmentStatus.PENDING,
    });
    const context = first.context;
    const members = [];
    for (const index of [0, 1, 2, 3]) {
      const member = await testData.createInstanceMember(context);
      await testData.createReviewAssignment({
        context,
        reviewer: member,
        title: `Search sort proposal ${index} ${task.id}`,
        status: ProposalReviewAssignmentStatus.PENDING,
      });
      members.push(member.profileId);
    }
    const idle = await testData.createInstanceReviewerWithRole(context);
    await testData.setCurrentPhase(context.instance.instance.id, 'review');

    const [memberA, memberB, memberC, memberD] = members;
    if (!memberA || !memberB || !memberC || !memberD) {
      throw new Error('Expected four seeded members');
    }

    // The names that match are given out of creation order, and the rows that
    // do not match sort between them.
    const searchToken = `Quillon ${task.id.slice(0, 8)}`;
    const names: Record<string, string> = {
      [memberA]: `${searchToken} C`,
      [memberB]: `Other ${task.id.slice(0, 8)} B`,
      [idle.profileId]: `${searchToken} A`,
      [memberC]: `${searchToken} B`,
      [memberD]: `Quill ${task.id.slice(0, 8)} D`,
      [context.defaultReviewer.profileId]: `Other ${task.id.slice(0, 8)} A`,
    };
    for (const [profileId, name] of Object.entries(names)) {
      await db.update(profiles).set({ name }).where(eq(profiles.id, profileId));
    }

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );
    const input = {
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
      search: searchToken.toLowerCase(),
      sort: 'name' as const,
    };
    const [rows, firstPage] = await Promise.all([
      walkAllPages({ caller: adminCaller, input }),
      adminCaller.decision.listPhaseReviewerSummaries({ ...input, limit: 2 }),
    ]);

    expect(firstPage.next).not.toBeNull();
    expect(rows.map((row) => row.reviewer.id)).toEqual([
      idle.profileId,
      memberC,
      memberA,
    ]);
    expect(firstPage.total).toBe(3);
    expect(firstPage.totalReviewers).toBeGreaterThanOrEqual(6);
  });

  it('searches reviewers by name and by email, case-insensitively', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const first = await testData.createReviewAssignment({
      title: `Search proposal ${task.id}`,
      status: ProposalReviewAssignmentStatus.PENDING,
    });
    const context = first.context;
    const named = await testData.createInstanceReviewerWithRole(context);
    const other = await testData.createInstanceMember(context);
    await testData.createReviewAssignment({
      context,
      reviewer: other,
      title: `Search proposal other ${task.id}`,
      status: ProposalReviewAssignmentStatus.PENDING,
    });
    await testData.setCurrentPhase(context.instance.instance.id, 'review');

    const nameToken = `Zephyrine ${task.id.slice(0, 8)}`;
    await db
      .update(profiles)
      .set({ name: nameToken })
      .where(eq(profiles.id, named.profileId));

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );
    const listFor = (search: string) =>
      adminCaller.decision.listPhaseReviewerSummaries({
        processInstanceId: context.instance.instance.id,
        phaseId: 'review',
        search,
      });

    const byName = await listFor(`  ${nameToken.toUpperCase()}  `);
    expect(byName.items.map((row) => row.reviewer.id)).toEqual([
      named.profileId,
    ]);
    expect(byName.total).toBe(1);
    expect(byName.totalReviewers).toBeGreaterThanOrEqual(3);

    const reversed = await listFor(nameToken.split(' ').reverse().join(' '));
    expect(reversed.items.map((row) => row.reviewer.id)).toEqual([
      named.profileId,
    ]);
    const extraWord = await listFor(`${nameToken} nomatch`);
    expect(extraWord.items).toEqual([]);

    const byEmail = await listFor(other.email.split('@')[0] ?? other.email);
    expect(byEmail.items.map((row) => row.reviewer.id)).toEqual([
      other.profileId,
    ]);
    expect(byEmail.total).toBe(1);

    const wildcard = await listFor('%');
    expect(wildcard.items).toEqual([]);
    expect(wildcard.total).toBe(0);

    const blank = await listFor('   ');
    expect(blank.total).toBe(blank.totalReviewers);
  });

  it('rejects a cursor that did not come from a previous page', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    await expect(
      adminCaller.decision.listPhaseReviewerSummaries({
        processInstanceId: context.instance.instance.id,
        phaseId: 'review',
        cursor: 'not-a-real-cursor',
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });
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
      reviewerCaller.decision.listPhaseReviewerSummaries({
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

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    await expect(
      adminCaller.decision.listPhaseReviewerSummaries({
        processInstanceId: context.instance.instance.id,
        phaseId: 'this-phase-does-not-exist',
      }),
    ).rejects.toMatchObject({ cause: { name: 'NotFoundError' } });
  });
});

type PhaseReviewerSummariesCaller = Awaited<
  ReturnType<typeof createAuthenticatedCaller>
>;

async function walkAllPages({
  caller,
  input,
  limit = 2,
}: {
  caller: PhaseReviewerSummariesCaller;
  input: Omit<PhaseReviewerSummariesInput, 'cursor' | 'limit'>;
  limit?: number;
}) {
  const rows: PhaseReviewerSummary[] = [];
  let cursor: string | null = null;

  do {
    const page: PhaseReviewerSummaries =
      await caller.decision.listPhaseReviewerSummaries({
        ...input,
        limit,
        cursor,
      });
    rows.push(...page.items);
    cursor = page.next;
  } while (cursor);

  return rows;
}

/**
 * Six reviewers, one per sort position. Completion: `full` 1/1, `half` 1/2,
 * `third` 1/3, `zeroLow` and `zeroHigh` 0/1 (ordered by id), `idle` nothing
 * assigned. Only `third` (newest) and `full` have a submitted review. Names
 * order them full, half, zero, zero, third, idle.
 */
async function seedSortedReviewers(
  testData: TestReviewsDataManager,
  testId: string,
) {
  const halfDone = await testData.createReviewAssignment({
    title: `Sorted proposal half done ${testId}`,
    status: ProposalReviewAssignmentStatus.COMPLETED,
  });
  const context = halfDone.context;
  await testData.createReviewAssignment({
    context,
    title: `Sorted proposal half open ${testId}`,
    status: ProposalReviewAssignmentStatus.PENDING,
  });

  const fullReviewer = await testData.createInstanceMember(context);
  const fullDone = await testData.createReviewAssignment({
    context,
    reviewer: fullReviewer,
    title: `Sorted proposal full ${testId}`,
    status: ProposalReviewAssignmentStatus.COMPLETED,
  });

  const thirdReviewer = await testData.createInstanceMember(context);
  const thirdDone = await testData.createReviewAssignment({
    context,
    reviewer: thirdReviewer,
    title: `Sorted proposal third done ${testId}`,
    status: ProposalReviewAssignmentStatus.COMPLETED,
  });
  for (const suffix of ['a', 'b']) {
    await testData.createReviewAssignment({
      context,
      reviewer: thirdReviewer,
      title: `Sorted proposal third open ${suffix} ${testId}`,
      status: ProposalReviewAssignmentStatus.PENDING,
    });
  }

  const zeroReviewers = [
    await testData.createInstanceMember(context),
    await testData.createInstanceMember(context),
  ];
  for (const [index, reviewer] of zeroReviewers.entries()) {
    await testData.createReviewAssignment({
      context,
      reviewer,
      title: `Sorted proposal zero ${index} ${testId}`,
      status: ProposalReviewAssignmentStatus.PENDING,
    });
  }
  const [zeroLow, zeroHigh] = zeroReviewers
    .map((reviewer) => reviewer.profileId)
    .sort();

  const idle = await testData.createInstanceReviewerWithRole(context);
  await testData.setCurrentPhase(context.instance.instance.id, 'review');

  const now = Date.now();
  await createProposalReview({
    assignmentId: fullDone.assignment.id,
    state: ProposalReviewState.SUBMITTED,
    reviewData: { answers: {}, rationales: {} },
    submittedAt: new Date(now - 60 * 60 * 1000).toISOString(),
  });
  await createProposalReview({
    assignmentId: thirdDone.assignment.id,
    state: ProposalReviewState.SUBMITTED,
    reviewData: { answers: {}, rationales: {} },
    submittedAt: new Date(now).toISOString(),
  });

  if (!zeroLow || !zeroHigh) {
    throw new Error('Expected two reviewers at a completion ratio of 0');
  }

  const reviewers = {
    half: context.defaultReviewer.profileId,
    full: fullReviewer.profileId,
    third: thirdReviewer.profileId,
    zeroLow,
    zeroHigh,
    idle: idle.profileId,
  };

  const nameToken = `Sorted ${testId.slice(0, 8)}`;
  const names: Record<string, string> = {
    [reviewers.full]: `${nameToken} A`,
    [reviewers.half]: `${nameToken} B`,
    [reviewers.zeroLow]: `${nameToken} C`,
    [reviewers.zeroHigh]: `${nameToken} C`,
    [reviewers.third]: `${nameToken} D`,
    [reviewers.idle]: `${nameToken} E`,
  };
  for (const [profileId, name] of Object.entries(names)) {
    await db.update(profiles).set({ name }).where(eq(profiles.id, profileId));
  }

  return { context, reviewers };
}

/**
 * Reviewers that tie on completion ratio but not on assignment count:
 * `zeroMany` 0/3, `zeroFewLow` and `zeroFewHigh` 0/1, `partMany` 2/4,
 * `partFew` 1/2, `fullMany` 2/2, `fullFew` 1/1, `idle` nothing assigned.
 * Each `Many` reviewer gets the higher id of its pair, so an id-only
 * tiebreak puts it last.
 */
async function seedCompletionTies(
  testData: TestReviewsDataManager,
  testId: string,
) {
  const context = await testData.createContext();
  const author = await testData.createInstanceMember(context);

  const createSortedMembers = async (count: number) => {
    const members = [];
    for (let index = 0; index < count; index++) {
      members.push(await testData.createInstanceMember(context));
    }
    // Code-unit order, which matches how Postgres orders the uuid column.
    return members.sort((a, b) => (a.profileId < b.profileId ? -1 : 1));
  };

  const assign = async ({
    reviewer,
    submitted,
    assigned,
    label,
  }: {
    reviewer: Awaited<ReturnType<typeof testData.createInstanceMember>>;
    submitted: number;
    assigned: number;
    label: string;
  }) => {
    for (let index = 0; index < assigned; index++) {
      await testData.createReviewAssignment({
        context,
        reviewer,
        author,
        title: `Tie proposal ${label} ${index} ${testId}`,
        status:
          index < submitted
            ? ProposalReviewAssignmentStatus.COMPLETED
            : ProposalReviewAssignmentStatus.PENDING,
      });
    }
  };

  const [zeroFewLow, zeroFewHigh, zeroMany] = await createSortedMembers(3);
  const [partFew, partMany] = await createSortedMembers(2);
  const [fullFew, fullMany] = await createSortedMembers(2);
  if (
    !zeroFewLow ||
    !zeroFewHigh ||
    !zeroMany ||
    !partFew ||
    !partMany ||
    !fullFew ||
    !fullMany
  ) {
    throw new Error('Expected seven reviewers for the completion ties');
  }

  await assign({
    reviewer: zeroMany,
    submitted: 0,
    assigned: 3,
    label: 'zero many',
  });
  await assign({
    reviewer: zeroFewLow,
    submitted: 0,
    assigned: 1,
    label: 'zero few low',
  });
  await assign({
    reviewer: zeroFewHigh,
    submitted: 0,
    assigned: 1,
    label: 'zero few high',
  });
  await assign({
    reviewer: partMany,
    submitted: 2,
    assigned: 4,
    label: 'part many',
  });
  await assign({
    reviewer: partFew,
    submitted: 1,
    assigned: 2,
    label: 'part few',
  });
  await assign({
    reviewer: fullMany,
    submitted: 2,
    assigned: 2,
    label: 'full many',
  });
  await assign({
    reviewer: fullFew,
    submitted: 1,
    assigned: 1,
    label: 'full few',
  });

  const idle = await testData.createInstanceReviewerWithRole(context);
  await testData.setCurrentPhase(context.instance.instance.id, 'review');

  return {
    context,
    reviewers: {
      zeroMany: zeroMany.profileId,
      zeroFewLow: zeroFewLow.profileId,
      zeroFewHigh: zeroFewHigh.profileId,
      partMany: partMany.profileId,
      partFew: partFew.profileId,
      fullMany: fullMany.profileId,
      fullFew: fullFew.profileId,
      idle: idle.profileId,
    },
  };
}

async function seedReviewerStatuses(
  testData: TestReviewsDataManager,
  testId: string,
) {
  const submitted = await testData.createReviewAssignment({
    title: `Status proposal submitted ${testId}`,
    status: ProposalReviewAssignmentStatus.COMPLETED,
  });
  const context = submitted.context;
  const drafted = await testData.createReviewAssignment({
    context,
    title: `Status proposal drafted ${testId}`,
    status: ProposalReviewAssignmentStatus.IN_PROGRESS,
  });

  const completedReviewer = await testData.createInstanceMember(context);
  const completed = await testData.createReviewAssignment({
    context,
    reviewer: completedReviewer,
    title: `Status proposal completed ${testId}`,
    status: ProposalReviewAssignmentStatus.COMPLETED,
  });

  const pendingReviewer = await testData.createInstanceMember(context);
  await testData.createReviewAssignment({
    context,
    reviewer: pendingReviewer,
    title: `Status proposal pending ${testId}`,
    status: ProposalReviewAssignmentStatus.PENDING,
  });

  const idle = await testData.createInstanceReviewerWithRole(context);
  await testData.setCurrentPhase(context.instance.instance.id, 'review');

  const submittedAt = new Date().toISOString();
  for (const assignmentId of [
    submitted.assignment.id,
    completed.assignment.id,
  ]) {
    await createProposalReview({
      assignmentId,
      state: ProposalReviewState.SUBMITTED,
      reviewData: { answers: {}, rationales: {} },
      submittedAt,
    });
  }
  await createProposalReview({
    assignmentId: drafted.assignment.id,
    state: ProposalReviewState.DRAFT,
    reviewData: { answers: {}, rationales: {} },
  });

  return {
    context,
    profileIdByStatus: {
      none: idle.profileId,
      [ProposalReviewAssignmentStatus.PENDING]: pendingReviewer.profileId,
      [ProposalReviewAssignmentStatus.IN_PROGRESS]:
        context.defaultReviewer.profileId,
      [ProposalReviewAssignmentStatus.COMPLETED]: completedReviewer.profileId,
    } satisfies Record<ReviewerStatus, string>,
  };
}

describeDecisionAccessTierGating('decision.listPhaseReviewerSummaries', {
  noJwtNonPublic: accessTierGatingCell(
    'rejects no-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestReviewsDataManager(task.id, onTestFinished);
      const context = await testData.createContext();

      const caller = await callers.noJwt();

      await expectFailsAccessTierGate(
        caller.decision.listPhaseReviewerSummaries({
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
        caller.decision.listPhaseReviewerSummaries({
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
        caller.decision.listPhaseReviewerSummaries({
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

      const result = await caller.decision.listPhaseReviewerSummaries({
        processInstanceId: context.instance.instance.id,
        phaseId: 'review',
      });

      expect(result.totalAssignments).toBe(0);
    },
  ),
});
