import { TestReviewsDataManager } from '@op/common/testing';
import { proposalCategories, taxonomyTerms } from '@op/db/schema';
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
