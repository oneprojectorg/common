import {
  TestDecisionsDataManager,
  TestReviewsDataManager,
  createDevelopPhaseSetup,
} from '@op/common/testing';
import {
  ProposalRelationshipType,
  ProposalStatus,
  Visibility,
  decisionTransitionProposals,
  proposalCategories,
  proposalRelationships,
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
  attachFormSchema,
  insertFormSchema,
  seedCollabFragments,
} from '../../../test/helpers/formSchemaTestUtils';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../../test/supabase-utils';
import { createCallerFactory } from '../../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

type Caller = ReturnType<typeof createCaller>;
type SourceList = Awaited<ReturnType<Caller['decision']['listDevelopSources']>>;
type ListInput = Parameters<Caller['decision']['listDevelopSources']>[0];

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

async function createSourcesContext({
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
    const page: SourceList = await caller.decision.listDevelopSources({
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

type SourceContext = Awaited<ReturnType<typeof createSourcesContext>>;
type EntryAuthor = Awaited<
  ReturnType<TestReviewsDataManager['createInstanceMember']>
>;

/**
 * Writes the entry and its `developed` edge directly: the list is under test,
 * not `createDevelopedProposal`. The entry is a submitted proposal of the same
 * phase, so it is also listed as a source. `developedAt` pins the edge order.
 */
async function developEntry({
  testData,
  context,
  source,
  author,
  developedAt,
  status = ProposalStatus.SUBMITTED,
  visibility = Visibility.VISIBLE,
}: {
  testData: TestReviewsDataManager;
  context: SourceContext['context'];
  source: { id: string };
  author: EntryAuthor;
  developedAt: Date;
  status?: ProposalStatus;
  visibility?: Visibility;
}) {
  const { proposal } = await testData.createReviewAssignment({
    context,
    title: `Entry of ${source.id}`,
    author,
  });
  await db
    .update(proposalsTable)
    .set({ status, visibility })
    .where(eq(proposalsTable.id, proposal.id));
  await db.insert(proposalRelationships).values({
    processInstanceId: context.instance.instance.id,
    sourceProposalId: source.id,
    targetProposalId: proposal.id,
    relationshipType: ProposalRelationshipType.DEVELOPED,
    createdAt: developedAt.toISOString(),
  });
  // The seeded document is empty, so a draft fails the template's required fields.
  return {
    id: proposal.id,
    profileId: proposal.profileId,
    status,
    isComplete: status === ProposalStatus.DRAFT ? false : null,
  };
}

function developedBySource(page: SourceList) {
  const bySource = new Map<
    string,
    SourceList['items'][number]['developedProposals']
  >();
  for (const item of page.items) {
    bySource.set(item.id, item.developedProposals);
  }
  return bySource;
}

describe.concurrent('decision.listDevelopSources', () => {
  it('lists the phase non-draft proposals for a plain member', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const { processInstanceId, proposals, memberCaller } =
      await createSourcesContext({
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

    const result = await memberCaller.decision.listDevelopSources({
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
      createSourcesContext({ testData, titles: ['Private'] }),
      testData.createContext(),
    ]);
    const outsiderCaller = await createAuthenticatedCaller(
      otherContext.defaultReviewer.email,
    );

    await expect(
      outsiderCaller.decision.listDevelopSources({
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
      await createSourcesContext({
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
      await createSourcesContext({
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
      reviewerCaller.decision.listDevelopSources({
        processInstanceId,
        phaseIds: ['review'],
        scope: 'assigned',
      }),
      reviewerCaller.decision.listDevelopSources({
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
      await createSourcesContext({
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
      await createSourcesContext({
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
      reviewerCaller.decision.listDevelopSources(filters),
      reviewerCaller.decision.listDevelopSources({
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
    const { processInstanceId, memberCaller } = await createSourcesContext({
      testData,
      titles: ['Assigned elsewhere'],
    });

    const result = await memberCaller.decision.listDevelopSources({
      processInstanceId,
      phaseIds: ['review'],
      scope: 'assigned',
    });

    expect(result).toEqual({ items: [], next: null, total: 0 });
  });

  it('rejects an unreadable cursor', async ({ task, onTestFinished }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const { processInstanceId, memberCaller } = await createSourcesContext({
      testData,
      titles: ['Only one'],
    });

    await expect(
      memberCaller.decision.listDevelopSources({
        processInstanceId,
        phaseIds: ['review'],
        cursor: 'not-a-cursor',
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });
  });
});

describe.concurrent('decision.listDevelopSources developedProposals', () => {
  it('returns the entries of each source the caller may read', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const sources = await createSourcesContext({
      testData,
      titles: ['No entry', 'Own draft', 'Other draft', 'Submitted', 'Two'],
    });
    const { context, processInstanceId, proposals } = sources;
    const [noEntry, ownDraftSource, otherDraftSource, submittedSource, two] =
      proposals;
    if (
      !noEntry ||
      !ownDraftSource ||
      !otherDraftSource ||
      !submittedSource ||
      !two
    ) {
      throw new Error('expected five proposals');
    }
    const [author, otherAuthor] = await Promise.all([
      testData.createInstanceMember(context),
      testData.createInstanceMember(context),
    ]);
    const now = Date.now();
    const ownDraft = await developEntry({
      testData,
      context,
      source: ownDraftSource,
      author,
      developedAt: new Date(now),
      status: ProposalStatus.DRAFT,
    });
    await developEntry({
      testData,
      context,
      source: otherDraftSource,
      author: otherAuthor,
      developedAt: new Date(now),
      status: ProposalStatus.DRAFT,
    });
    const submitted = await developEntry({
      testData,
      context,
      source: submittedSource,
      author,
      developedAt: new Date(now),
    });
    // Written newest first, so only the SQL order can put them oldest first.
    const secondOfTwo = await developEntry({
      testData,
      context,
      source: two,
      author: otherAuthor,
      developedAt: new Date(now),
    });
    const firstOfTwo = await developEntry({
      testData,
      context,
      source: two,
      author: otherAuthor,
      developedAt: new Date(now - 60_000),
    });
    const [authorCaller, adminCaller] = await Promise.all([
      createAuthenticatedCaller(author.email),
      createAuthenticatedCaller(context.defaultReviewer.email),
    ]);

    const [authorPage, adminPage] = await Promise.all([
      authorCaller.decision.listDevelopSources({
        processInstanceId,
        phaseIds: ['review'],
      }),
      adminCaller.decision.listDevelopSources({
        processInstanceId,
        phaseIds: ['review'],
      }),
    ]);

    const authorView = developedBySource(authorPage);
    expect(authorView.get(noEntry.id)).toEqual([]);
    expect(authorView.get(ownDraftSource.id)).toEqual([ownDraft]);
    expect(authorView.get(otherDraftSource.id)).toEqual([]);
    expect(authorView.get(submittedSource.id)).toEqual([submitted]);
    expect(authorView.get(two.id)).toEqual([firstOfTwo, secondOfTwo]);

    // An admin never sees another person's draft.
    const adminView = developedBySource(adminPage);
    expect(adminView.get(noEntry.id)).toEqual([]);
    expect(adminView.get(ownDraftSource.id)).toEqual([]);
    expect(adminView.get(otherDraftSource.id)).toEqual([]);
    expect(adminView.get(submittedSource.id)).toEqual([submitted]);
    expect(adminView.get(two.id)).toEqual([firstOfTwo, secondOfTwo]);

    // The submitted entries are listed as sources too, with no entry of their own.
    expect(adminView.get(submitted.id)).toEqual([]);
  });

  it('returns a hidden entry to an admin and its author only', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const { context, processInstanceId, proposals, memberCaller } =
      await createSourcesContext({ testData, titles: ['Hidden entry'] });
    const [source] = proposals;
    if (!source) {
      throw new Error('expected one proposal');
    }
    const author = await testData.createInstanceMember(context);
    const hidden = await developEntry({
      testData,
      context,
      source,
      author,
      developedAt: new Date(),
      visibility: Visibility.HIDDEN,
    });
    const [authorCaller, adminCaller] = await Promise.all([
      createAuthenticatedCaller(author.email),
      createAuthenticatedCaller(context.defaultReviewer.email),
    ]);
    const input = { processInstanceId, phaseIds: ['review'] };

    const [authorPage, adminPage, memberPage] = await Promise.all([
      authorCaller.decision.listDevelopSources(input),
      adminCaller.decision.listDevelopSources(input),
      memberCaller.decision.listDevelopSources(input),
    ]);

    expect(developedBySource(authorPage).get(source.id)).toEqual([hidden]);
    expect(developedBySource(adminPage).get(source.id)).toEqual([hidden]);
    expect(developedBySource(memberPage).get(source.id)).toEqual([]);
  });

  it('leaves the field off listReviewProposals', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const { context, processInstanceId, proposals } =
      await createSourcesContext({ testData, titles: ['Developed'] });
    const [source] = proposals;
    if (!source) {
      throw new Error('expected one proposal');
    }
    const author = await testData.createInstanceMember(context);
    await developEntry({
      testData,
      context,
      source,
      author,
      developedAt: new Date(),
    });
    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.listReviewProposals({
      processInstanceId,
      phaseId: 'review',
    });

    expect(result.items.map((item) => item.id)).toContain(source.id);
    for (const item of result.items) {
      expect(item).not.toHaveProperty('developedProposals');
    }
  });

  it('marks a draft entry complete only when it passes the submit checks, and leaves a submitted entry unchecked', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, source } = await createDevelopPhaseSetup({
      testData,
    });
    const caller = await createAuthenticatedCaller(setup.userEmail);
    const budgetRequired = await insertFormSchema({
      processInstanceId: instanceId,
      name: 'Entry',
      schema: {
        type: 'object',
        required: ['title', 'budget'],
        'x-field-order': ['title', 'budget'],
        properties: {
          title: { type: 'string', title: 'Title', 'x-format': 'short-text' },
          budget: {
            type: 'object',
            title: 'Budget',
            'x-format': 'money',
            properties: {
              amount: { type: 'number' },
              currency: { type: 'string', default: 'USD' },
            },
          },
        },
      },
    });
    // The editor autosave stores the budget in proposalData too; submit reads it there.
    const createEntry = async ({
      title,
      budget,
    }: {
      title: string;
      budget?: { amount: number; currency: string };
    }) => {
      const entry = await caller.decision.createDevelopedProposal({
        processInstanceId: instanceId,
        sourceProposalIds: [source.id],
        proposalData: { title },
      });
      testData.trackProfileForCleanup(entry.profileId);
      await attachFormSchema(entry.id, budgetRequired.id);
      await seedCollabFragments(entry.id, {
        title,
        ...(budget ? { budget: JSON.stringify(budget) } : {}),
      });
      if (budget) {
        await db
          .update(proposalsTable)
          .set({
            proposalData: {
              title,
              budget,
              collaborationDocId: `proposal-${entry.id}`,
            },
          })
          .where(eq(proposalsTable.id, entry.id));
      }
      return entry;
    };
    const budget = { amount: 500, currency: 'USD' };
    // Sequential, so the edges keep the creation order.
    const noBudget = await createEntry({ title: 'No budget' });
    const complete = await createEntry({ title: 'Complete', budget });
    const submitted = await createEntry({ title: 'Submitted', budget });
    await caller.decision.submitDevelopedProposal({ proposalId: submitted.id });

    const page = await caller.decision.listDevelopSources({
      processInstanceId: instanceId,
      phaseIds: ['initial'],
    });

    expect(developedBySource(page).get(source.id)).toEqual([
      expect.objectContaining({ id: noBudget.id, isComplete: false }),
      expect.objectContaining({ id: complete.id, isComplete: true }),
      expect.objectContaining({
        id: submitted.id,
        status: ProposalStatus.SUBMITTED,
        isComplete: null,
      }),
    ]);
  });
});
