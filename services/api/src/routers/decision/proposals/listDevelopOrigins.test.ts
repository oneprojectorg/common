import { TestReviewsDataManager } from '@op/common/testing';
import {
  ProposalStatus,
  decisionTransitionProposals,
  proposalCategories,
  proposalReviewAssignments,
  proposals as proposalsTable,
  stateTransitionHistory,
  taxonomyTerms,
} from '@op/db/schema';
import { db } from '@op/db/test';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../../test/supabase-utils';
import { createCallerFactory } from '../../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

type Caller = ReturnType<typeof createCaller>;
type OriginList = Awaited<ReturnType<Caller['decision']['listDevelopOrigins']>>;
type ListInput = Parameters<Caller['decision']['listDevelopOrigins']>[0];

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

async function createOriginsContext({
  testData,
  titles,
  assignedToReviewer = [],
}: {
  testData: TestReviewsDataManager;
  titles: string[];
  assignedToReviewer?: string[];
}) {
  const context = await testData.createContext();
  const [reviewer, member] = await Promise.all([
    testData.createInstanceReviewerWithRole(context),
    testData.createInstanceMember(context),
  ]);
  const proposals = [];
  // Sequential, so each proposal gets a later `createdAt`.
  for (const title of titles) {
    const { proposal } = await testData.createReviewAssignment({
      context,
      title,
      ...(assignedToReviewer.includes(title) ? { reviewer } : {}),
    });
    proposals.push(proposal);
  }
  const [reviewerCaller, memberCaller] = await Promise.all([
    createAuthenticatedCaller(reviewer.email),
    createAuthenticatedCaller(member.email),
  ]);
  return {
    context,
    processInstanceId: context.instance.instance.id,
    reviewer,
    proposals,
    reviewerCaller,
    memberCaller,
  };
}

async function readAllPages(caller: Caller, input: ListInput) {
  const ids: string[] = [];
  const totals: number[] = [];
  let cursor: string | null = null;
  let pages = 0;
  do {
    const page: OriginList = await caller.decision.listDevelopOrigins({
      ...input,
      cursor,
    });
    ids.push(...page.items.map((item) => item.id));
    totals.push(page.total);
    cursor = page.next;
    pages += 1;
  } while (cursor && pages < 10);
  return { ids, totals, pages };
}

async function createTerm(
  label: string,
  onTestFinished: (fn: () => Promise<void>) => void,
) {
  const [term] = await db
    .insert(taxonomyTerms)
    .values({ termUri: `${label.toLowerCase()}-${randomUUID()}`, label })
    .returning();
  if (!term) {
    throw new Error('failed to create taxonomy term');
  }
  onTestFinished(async () => {
    await db.delete(taxonomyTerms).where(eq(taxonomyTerms.id, term.id));
  });
  return term;
}

async function tagProposal(proposalId: string, termIds: string[]) {
  await db
    .insert(proposalCategories)
    .values(termIds.map((taxonomyTermId) => ({ proposalId, taxonomyTermId })));
}

async function assignOnPhase({
  processInstanceId,
  proposalId,
  reviewerProfileId,
  phaseId,
}: {
  processInstanceId: string;
  proposalId: string;
  reviewerProfileId: string;
  phaseId: string;
}) {
  await db
    .insert(proposalReviewAssignments)
    .values({ processInstanceId, proposalId, reviewerProfileId, phaseId });
}

/** Every proposal created before now sits in `submission`; the attached ones also in `review`. */
async function transitionIntoReview({
  processInstanceId,
  attachedProposalIds,
}: {
  processInstanceId: string;
  attachedProposalIds: string[];
}) {
  const [transition] = await db
    .insert(stateTransitionHistory)
    .values({
      processInstanceId,
      fromStateId: 'submission',
      toStateId: 'review',
    })
    .returning({ id: stateTransitionHistory.id });
  if (!transition) {
    throw new Error('failed to create transition');
  }
  for (const proposalId of attachedProposalIds) {
    const history = await db.query.proposalHistory.findFirst({
      columns: { historyId: true },
      where: { id: proposalId },
      orderBy: { historyCreatedAt: 'desc' },
    });
    if (!history) {
      throw new Error('expected a proposal history row');
    }
    await db.insert(decisionTransitionProposals).values({
      processInstanceId,
      transitionHistoryId: transition.id,
      proposalId,
      proposalHistoryId: history.historyId,
    });
  }
}

describe.concurrent('decision.listDevelopOrigins', () => {
  it('lists the phase non-draft proposals for a plain member', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const { processInstanceId, proposals, memberCaller } =
      await createOriginsContext({
        testData,
        titles: ['First', 'Second', 'Draft'],
      });
    const [first, second, draft] = proposals;
    if (!first || !second || !draft) {
      throw new Error('expected three proposals');
    }
    await db
      .update(proposalsTable)
      .set({ status: ProposalStatus.DRAFT })
      .where(eq(proposalsTable.id, draft.id));

    const result = await memberCaller.decision.listDevelopOrigins({
      processInstanceId,
      phaseIds: ['review'],
    });

    expect(result.items.map((item) => item.id)).toEqual([second.id, first.id]);
    expect(result.total).toBe(2);
    expect(result.next).toBeNull();
  });

  it('rejects a caller with no access to the instance', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const [{ processInstanceId }, otherContext] = await Promise.all([
      createOriginsContext({ testData, titles: ['Private'] }),
      testData.createContext(),
    ]);
    const outsiderCaller = await createAuthenticatedCaller(
      otherContext.defaultReviewer.email,
    );

    await expect(
      outsiderCaller.decision.listDevelopOrigins({
        processInstanceId,
        phaseIds: ['review'],
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });

  it('lists only the caller assigned proposals under assigned', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const { processInstanceId, proposals, reviewerCaller } =
      await createOriginsContext({
        testData,
        titles: ['Mine one', 'Theirs', 'Mine two'],
        assignedToReviewer: ['Mine one', 'Mine two'],
      });
    const [mineOne, , mineTwo] = proposals;

    const { ids, totals, pages } = await readAllPages(reviewerCaller, {
      processInstanceId,
      phaseIds: ['review'],
      scope: 'assigned',
      limit: 1,
    });

    expect(ids).toEqual([mineTwo?.id, mineOne?.id]);
    expect(totals).toEqual([2, 2]);
    expect(pages).toBe(2);
  });

  it('matches an assignment on any listed phase and none outside them', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const { processInstanceId, reviewer, proposals, reviewerCaller } =
      await createOriginsContext({
        testData,
        titles: ['On review', 'On submission'],
        assignedToReviewer: ['On review'],
      });
    const [onReview, onSubmission] = proposals;
    if (!onReview || !onSubmission) {
      throw new Error('expected two proposals');
    }
    await assignOnPhase({
      processInstanceId,
      proposalId: onSubmission.id,
      reviewerProfileId: reviewer.profileId,
      phaseId: 'submission',
    });

    const [reviewOnly, bothPhases] = await Promise.all([
      reviewerCaller.decision.listDevelopOrigins({
        processInstanceId,
        phaseIds: ['review'],
        scope: 'assigned',
      }),
      reviewerCaller.decision.listDevelopOrigins({
        processInstanceId,
        phaseIds: ['submission', 'review'],
        scope: 'assigned',
      }),
    ]);

    expect(reviewOnly.items.map((item) => item.id)).toEqual([onReview.id]);
    expect(reviewOnly.total).toBe(1);
    expect(bothPhases.items.map((item) => item.id)).toEqual([
      onSubmission.id,
      onReview.id,
    ]);
    expect(bothPhases.total).toBe(2);
  });

  it('lists a proposal in two of the phases once, across pages', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const { processInstanceId, proposals, memberCaller } =
      await createOriginsContext({
        testData,
        titles: ['Advanced one', 'Advanced two', 'Left behind'],
      });
    const [advancedOne, advancedTwo, leftBehind] = proposals;
    if (!advancedOne || !advancedTwo || !leftBehind) {
      throw new Error('expected three proposals');
    }
    await transitionIntoReview({
      processInstanceId,
      attachedProposalIds: [advancedOne.id, advancedTwo.id],
    });

    const [reviewOnly, union] = await Promise.all([
      readAllPages(memberCaller, {
        processInstanceId,
        phaseIds: ['review'],
      }),
      readAllPages(memberCaller, {
        processInstanceId,
        phaseIds: ['submission', 'review'],
        limit: 2,
      }),
    ]);

    expect(reviewOnly.ids).toEqual([advancedTwo.id, advancedOne.id]);
    expect(union.ids).toEqual([leftBehind.id, advancedTwo.id, advancedOne.id]);
    expect(union.totals).toEqual([3, 3]);
    expect(union.pages).toBe(2);
  });

  it('combines search and categoryIds with both scopes', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const { processInstanceId, proposals, reviewerCaller } =
      await createOriginsContext({
        testData,
        titles: [
          'Garden tagged',
          'Garden untagged',
          'Library tagged',
          'Garden not mine',
        ],
        assignedToReviewer: [
          'Garden tagged',
          'Garden untagged',
          'Library tagged',
        ],
      });
    const [gardenTagged, gardenUntagged, libraryTagged, gardenNotMine] =
      proposals;
    if (!gardenTagged || !gardenUntagged || !libraryTagged || !gardenNotMine) {
      throw new Error('expected four proposals');
    }
    const term = await createTerm('Parks', onTestFinished);
    await Promise.all([
      tagProposal(gardenTagged.id, [term.id]),
      tagProposal(libraryTagged.id, [term.id]),
      tagProposal(gardenNotMine.id, [term.id]),
    ]);

    const filters = {
      processInstanceId,
      phaseIds: ['review'],
      search: 'garden',
      categoryIds: [term.id],
    };
    const [all, assigned] = await Promise.all([
      reviewerCaller.decision.listDevelopOrigins(filters),
      reviewerCaller.decision.listDevelopOrigins({
        ...filters,
        scope: 'assigned',
      }),
    ]);

    expect(all.items.map((item) => item.id)).toEqual([
      gardenNotMine.id,
      gardenTagged.id,
    ]);
    expect(all.total).toBe(2);
    expect(assigned.items.map((item) => item.id)).toEqual([gardenTagged.id]);
    expect(assigned.total).toBe(1);
  });

  it('returns an empty list to a caller with no assignments', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const { processInstanceId, memberCaller } = await createOriginsContext({
      testData,
      titles: ['Assigned elsewhere'],
    });

    const result = await memberCaller.decision.listDevelopOrigins({
      processInstanceId,
      phaseIds: ['review'],
      scope: 'assigned',
    });

    expect(result).toEqual({ items: [], next: null, total: 0 });
  });

  it('rejects an unreadable cursor', async ({ task, onTestFinished }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const { processInstanceId, memberCaller } = await createOriginsContext({
      testData,
      titles: ['Only one'],
    });

    await expect(
      memberCaller.decision.listDevelopOrigins({
        processInstanceId,
        phaseIds: ['review'],
        cursor: 'not-a-cursor',
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });
  });
});
