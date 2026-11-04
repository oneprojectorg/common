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

  it('lists reviewers with nothing assigned last under both completion sorts', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const { context } = await seedSortedReviewers(testData, task.id);

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    for (const sort of ['leastComplete', 'mostComplete'] as const) {
      const rows = await walkAllPages({
        caller: adminCaller,
        input: {
          processInstanceId: context.instance.instance.id,
          phaseId: 'review',
          sort,
        },
      });
      const firstUnassigned = rows.findIndex((row) => row.assignedCount === 0);

      expect(firstUnassigned, sort).toBeGreaterThan(0);
      expect(
        rows.slice(firstUnassigned).every((row) => row.assignedCount === 0),
        sort,
      ).toBe(true);
    }
  });

  it('keeps paging when a page ends on a completion ratio of 0', async ({
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

    // A page of one ends between the two reviewers at 0.
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

    // A page of two ends on the second reviewer at 0.
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
  });

  it('rejects a cursor whose sort value does not fit its cast', async ({
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
      { sort: 'leastComplete', completionRatio: 'abc', id },
      { sort: 'mostComplete', completionRatio: '-1', id },
      { sort: 'recentActivity', lastSubmittedAt: 'abc', id },
      { sort: 'recentActivity', lastSubmittedAt: '2026-02-30 10:00:00+00', id },
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

  it('pages a status filter under a sort, with only that status and a filtered total', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const { context, inProgress } = await seedInProgressReviewers(
      testData,
      task.id,
    );

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );
    const input = {
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
    };
    const [rows, firstPage, unfiltered] = await Promise.all([
      walkAllPages({
        caller: adminCaller,
        input: {
          ...input,
          status: ProposalReviewAssignmentStatus.IN_PROGRESS,
          sort: 'mostComplete',
        },
      }),
      adminCaller.decision.listPhaseReviewerSummaries({
        ...input,
        status: ProposalReviewAssignmentStatus.IN_PROGRESS,
        sort: 'mostComplete',
        limit: 2,
      }),
      adminCaller.decision.listPhaseReviewerSummaries(input),
    ]);
    const rowIds = rows.map((row) => row.reviewer.id);

    expect(firstPage.next).not.toBeNull();
    expect(rows.map((row) => row.status)).toEqual(
      rows.map(() => ProposalReviewAssignmentStatus.IN_PROGRESS),
    );
    expect(rowIds).toEqual([
      inProgress.twoThirds,
      inProgress.half,
      inProgress.third,
      inProgress.draftLow,
      inProgress.draftHigh,
    ]);
    expect(new Set(rowIds).size).toBe(rowIds.length);
    expect(firstPage.total).toBe(rowIds.length);
    expect(firstPage.totalReviewers).toBe(unfiltered.totalReviewers);
    expect(firstPage.totalReviewers).toBeGreaterThan(firstPage.total);
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

    // Reviewers in the other statuses, so the filter has rows to drop.
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

/** Follows `next` from the first page to the last, two rows at a time. */
async function walkAllPages({
  caller,
  input,
}: {
  caller: PhaseReviewerSummariesCaller;
  input: Omit<PhaseReviewerSummariesInput, 'cursor' | 'limit'>;
}) {
  const rows: PhaseReviewerSummary[] = [];
  let cursor: string | null = null;

  do {
    const page: PhaseReviewerSummaries =
      await caller.decision.listPhaseReviewerSummaries({
        ...input,
        limit: 2,
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
 * Five reviewers in progress, by completion: `twoThirds` 2/3, `half` 1/2,
 * `third` 1/3, `draftLow` and `draftHigh` 0/1 with a draft (ordered by id).
 * Beside them, one reviewer per other status: completed, not started, and
 * without assignments.
 */
async function seedInProgressReviewers(
  testData: TestReviewsDataManager,
  testId: string,
) {
  const halfDone = await testData.createReviewAssignment({
    title: `In progress proposal half done ${testId}`,
    status: ProposalReviewAssignmentStatus.COMPLETED,
  });
  const context = halfDone.context;
  const completedAssignmentIds = [halfDone.assignment.id];
  const draftAssignmentIds: string[] = [];

  const assign = async ({
    reviewer,
    completed,
    pending,
    drafted = 0,
    label,
  }: {
    reviewer?: Awaited<ReturnType<typeof testData.createInstanceMember>>;
    completed: number;
    pending: number;
    drafted?: number;
    label: string;
  }) => {
    const plan = [
      ...Array.from({ length: completed }, () => 'completed' as const),
      ...Array.from({ length: pending }, () => 'pending' as const),
      ...Array.from({ length: drafted }, () => 'drafted' as const),
    ];
    for (const [index, kind] of plan.entries()) {
      const { assignment } = await testData.createReviewAssignment({
        context,
        reviewer,
        title: `In progress proposal ${label} ${kind} ${index} ${testId}`,
        status:
          kind === 'completed'
            ? ProposalReviewAssignmentStatus.COMPLETED
            : kind === 'drafted'
              ? ProposalReviewAssignmentStatus.IN_PROGRESS
              : ProposalReviewAssignmentStatus.PENDING,
      });
      if (kind === 'completed') {
        completedAssignmentIds.push(assignment.id);
      }
      if (kind === 'drafted') {
        draftAssignmentIds.push(assignment.id);
      }
    }
  };

  await assign({ completed: 0, pending: 1, label: 'half' });

  const twoThirds = await testData.createInstanceMember(context);
  await assign({
    reviewer: twoThirds,
    completed: 2,
    pending: 1,
    label: 'two thirds',
  });

  const third = await testData.createInstanceMember(context);
  await assign({ reviewer: third, completed: 1, pending: 2, label: 'third' });

  const drafters = [
    await testData.createInstanceMember(context),
    await testData.createInstanceMember(context),
  ];
  for (const [index, reviewer] of drafters.entries()) {
    await assign({
      reviewer,
      completed: 0,
      pending: 0,
      drafted: 1,
      label: `draft ${index}`,
    });
  }
  const [draftLow, draftHigh] = drafters
    .map((reviewer) => reviewer.profileId)
    .sort();

  const completedReviewer = await testData.createInstanceMember(context);
  await assign({
    reviewer: completedReviewer,
    completed: 1,
    pending: 0,
    label: 'completed',
  });

  const pendingReviewer = await testData.createInstanceMember(context);
  await assign({
    reviewer: pendingReviewer,
    completed: 0,
    pending: 1,
    label: 'pending',
  });

  await testData.createInstanceReviewerWithRole(context);
  await testData.setCurrentPhase(context.instance.instance.id, 'review');

  const submittedAt = new Date().toISOString();
  for (const assignmentId of completedAssignmentIds) {
    await createProposalReview({
      assignmentId,
      state: ProposalReviewState.SUBMITTED,
      reviewData: { answers: {}, rationales: {} },
      submittedAt,
    });
  }
  for (const assignmentId of draftAssignmentIds) {
    await createProposalReview({
      assignmentId,
      state: ProposalReviewState.DRAFT,
      reviewData: { answers: {}, rationales: {} },
    });
  }

  if (!draftLow || !draftHigh) {
    throw new Error('Expected two reviewers with only a draft');
  }

  return {
    context,
    inProgress: {
      twoThirds: twoThirds.profileId,
      half: context.defaultReviewer.profileId,
      third: third.profileId,
      draftLow,
      draftHigh,
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
