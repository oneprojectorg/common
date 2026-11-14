import {
  TestReviewsDataManager,
  createProposalReview,
  createReviewAssignment,
} from '@op/common/testing';
import {
  ProposalReviewState,
  proposalCategories,
  proposalReviewAssignments,
  taxonomyTerms,
} from '@op/db/schema';
import { db } from '@op/db/test';
import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
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

/** Creates `titles.length` proposals in the review phase, oldest first. */
async function createReviewProposals(
  testData: TestReviewsDataManager,
  titles: string[],
) {
  const context = await testData.createContext();
  const created = [];
  // Sequential, so each proposal gets a later `createdAt`.
  for (const title of titles) {
    const { proposal } = await testData.createReviewAssignment({
      context,
      title,
    });
    created.push(proposal);
  }
  const adminCaller = await createAuthenticatedCaller(
    context.defaultReviewer.email,
  );
  return { context, proposals: created, adminCaller };
}

describe.concurrent('decision.listReviewProposals', () => {
  it('lists the phase proposals newest first with a total', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const { context, proposals, adminCaller } = await createReviewProposals(
      testData,
      ['First garden', 'Second garden', 'Third garden'],
    );

    const result = await adminCaller.decision.listReviewProposals({
      processInstanceId: context.instance.instance.id,
    });

    expect(result.items.map((item) => item.id)).toEqual(
      proposals.map((proposal) => proposal.id).reverse(),
    );
    expect(result.total).toBe(3);
    expect(result.next).toBeNull();
    // Same item shape as `proposal.list`.
    expect(result.items[0]).toMatchObject({
      processInstanceId: context.instance.instance.id,
      profileId: proposals[2]?.profileId,
    });
  });

  it('requires every given category term', async ({ task, onTestFinished }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const { context, proposals, adminCaller } = await createReviewProposals(
      testData,
      ['Both terms', 'Category only', 'District only'],
    );
    const [both, categoryOnly, districtOnly] = proposals;
    if (!both || !categoryOnly || !districtOnly) {
      throw new Error('expected three proposals');
    }
    const [category, district] = await Promise.all([
      createTerm('Parks', onTestFinished),
      createTerm('District 1', onTestFinished),
    ]);
    await Promise.all([
      tagProposal(both.id, [category.id, district.id]),
      tagProposal(categoryOnly.id, [category.id]),
      tagProposal(districtOnly.id, [district.id]),
    ]);

    const [categoryResult, bothResult] = await Promise.all([
      adminCaller.decision.listReviewProposals({
        processInstanceId: context.instance.instance.id,
        categoryIds: [category.id],
      }),
      adminCaller.decision.listReviewProposals({
        processInstanceId: context.instance.instance.id,
        categoryIds: [category.id, district.id],
      }),
    ]);

    expect(categoryResult.items.map((item) => item.id)).toEqual([
      categoryOnly.id,
      both.id,
    ]);
    expect(bothResult.items.map((item) => item.id)).toEqual([both.id]);
    expect(bothResult.total).toBe(1);
  });

  it('searches titles like proposal.list', async ({ task, onTestFinished }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const { context, adminCaller } = await createReviewProposals(testData, [
      'Community garden expansion',
      'Library roof repair',
    ]);

    const input = {
      processInstanceId: context.instance.instance.id,
      search: 'garden COMM',
    };
    const [result, proposalList] = await Promise.all([
      adminCaller.decision.listReviewProposals(input),
      adminCaller.decision.listProposals(input),
    ]);

    expect(result.items.map((item) => item.id)).toEqual(
      proposalList.items.map((item) => item.id),
    );
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('pages with a keyset cursor without repeats or gaps', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const { context, proposals, adminCaller } = await createReviewProposals(
      testData,
      ['One', 'Two', 'Three', 'Four', 'Five'],
    );

    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const page: Awaited<
        ReturnType<typeof adminCaller.decision.listReviewProposals>
      > = await adminCaller.decision.listReviewProposals({
        processInstanceId: context.instance.instance.id,
        limit: 2,
        cursor,
      });
      expect(page.total).toBe(5);
      seen.push(...page.items.map((item) => item.id));
      cursor = page.next;
      pages += 1;
    } while (cursor && pages < 10);

    expect(pages).toBe(3);
    expect(seen).toEqual(proposals.map((proposal) => proposal.id).reverse());
  });

  it('sorts by submitted reviews, then assignments, across pages', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    // Each proposal starts with one assignment to the default reviewer.
    const { context, proposals, adminCaller } = await createReviewProposals(
      testData,
      ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'],
    );
    const [p1, p2, p3, p4, p5, p6] = proposals;
    if (!p1 || !p2 || !p3 || !p4 || !p5 || !p6) {
      throw new Error('expected six proposals');
    }
    const [second, third] = await Promise.all([
      testData.createReviewer(context),
      testData.createReviewer(context),
    ]);
    const processInstanceId = context.instance.instance.id;

    const assign = (proposalId: string, reviewerProfileId: string) =>
      createReviewAssignment({
        processInstanceId,
        proposalId,
        reviewerProfileId,
      });
    const review = async (
      proposalId: string,
      reviewerProfileId: string,
      state = ProposalReviewState.SUBMITTED,
    ) => {
      const [assignment] = await db
        .select({ id: proposalReviewAssignments.id })
        .from(proposalReviewAssignments)
        .where(
          and(
            eq(proposalReviewAssignments.proposalId, proposalId),
            eq(proposalReviewAssignments.reviewerProfileId, reviewerProfileId),
          ),
        );
      if (!assignment) {
        throw new Error('assignment not found');
      }
      await createProposalReview({
        assignmentId: assignment.id,
        state,
        reviewData: { answers: {}, rationales: {} },
        submittedAt:
          state === ProposalReviewState.SUBMITTED
            ? new Date().toISOString()
            : null,
      });
    };
    const defaultReviewer = context.defaultReviewer.profileId;

    // submitted / assigned: P1 0/1 (a draft), P2 1/2, P3 1/1, P4 2/3, P5 0/2,
    // P6 0/1.
    await Promise.all([
      assign(p2.id, second.profileId),
      assign(p4.id, second.profileId),
      assign(p4.id, third.profileId),
      assign(p5.id, second.profileId),
    ]);
    await Promise.all([
      review(p1.id, defaultReviewer, ProposalReviewState.DRAFT),
      review(p2.id, defaultReviewer),
      review(p3.id, defaultReviewer),
      review(p4.id, defaultReviewer),
      review(p4.id, second.profileId),
    ]);

    const readAll = async (sort: 'fewestReviews' | 'mostReviews') => {
      const seen: string[] = [];
      let cursor: string | null = null;
      let pages = 0;
      do {
        const page: Awaited<
          ReturnType<typeof adminCaller.decision.listReviewProposals>
        > = await adminCaller.decision.listReviewProposals({
          processInstanceId,
          sort,
          limit: 2,
          cursor,
        });
        seen.push(...page.items.map((item) => item.id));
        cursor = page.next;
        pages += 1;
      } while (cursor && pages < 10);
      return { seen, pages };
    };

    const [fewest, most] = await Promise.all([
      readAll('fewestReviews'),
      readAll('mostReviews'),
    ]);

    expect(fewest.pages).toBe(3);
    expect(fewest.seen).toEqual([p1.id, p6.id, p5.id, p3.id, p2.id, p4.id]);
    expect(most.pages).toBe(3);
    expect(most.seen).toEqual([p4.id, p2.id, p3.id, p5.id, p6.id, p1.id]);
  });

  it('rejects a cursor from another sort', async ({ task, onTestFinished }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const { context, adminCaller } = await createReviewProposals(testData, [
      'One',
      'Two',
    ]);
    const processInstanceId = context.instance.instance.id;

    const page = await adminCaller.decision.listReviewProposals({
      processInstanceId,
      limit: 1,
    });

    await expect(
      adminCaller.decision.listReviewProposals({
        processInstanceId,
        sort: 'mostReviews',
        limit: 1,
        cursor: page.next,
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });
  });

  it('rejects an unreadable cursor', async ({ task, onTestFinished }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const { context, adminCaller } = await createReviewProposals(testData, [
      'Only one',
    ]);

    await expect(
      adminCaller.decision.listReviewProposals({
        processInstanceId: context.instance.instance.id,
        cursor: 'not-a-cursor',
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });
  });

  it('admits a reviewer on a phase with open reviews', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const { context, proposals } = await createReviewProposals(testData, [
      'Open review proposal',
    ]);
    await testData.setPhaseOpenReviews(
      context.instance.instance.id,
      'review',
      true,
    );
    const reviewer = await testData.createInstanceReviewerWithRole(context);
    const reviewerCaller = await createAuthenticatedCaller(reviewer.email);

    const result = await reviewerCaller.decision.listReviewProposals({
      processInstanceId: context.instance.instance.id,
    });

    expect(result.items.map((item) => item.id)).toEqual([proposals[0]?.id]);
  });

  it('rejects a reviewer when reviews are not open', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const { context } = await createReviewProposals(testData, [
      'Closed review proposal',
    ]);
    await testData.setPhaseOpenReviews(
      context.instance.instance.id,
      'review',
      false,
    );
    const reviewer = await testData.createInstanceReviewerWithRole(context);
    const reviewerCaller = await createAuthenticatedCaller(reviewer.email);

    await expect(
      reviewerCaller.decision.listReviewProposals({
        processInstanceId: context.instance.instance.id,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });

  it('rejects a member without the review capability', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const { context } = await createReviewProposals(testData, [
      'Member proposal',
    ]);
    await testData.setPhaseOpenReviews(
      context.instance.instance.id,
      'review',
      true,
    );
    const member = await testData.createInstanceMember(context);
    const memberCaller = await createAuthenticatedCaller(member.email);

    await expect(
      memberCaller.decision.listReviewProposals({
        processInstanceId: context.instance.instance.id,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });
});
