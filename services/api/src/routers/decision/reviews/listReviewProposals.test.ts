import { TestReviewsDataManager } from '@op/common/testing';
import {
  ProposalStatus,
  proposalCategories,
  proposalReviewAssignments,
  proposals as proposalsTable,
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

  it('rejects a well-formed cursor whose value is not a timestamp', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const { context, adminCaller } = await createReviewProposals(testData, [
      'Only one',
    ]);
    const cursor = Buffer.from(
      JSON.stringify({ value: 'not-a-date', id: randomUUID() }),
    ).toString('base64');

    await expect(
      adminCaller.decision.listReviewProposals({
        processInstanceId: context.instance.instance.id,
        cursor,
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });
  });

  it('leaves drafts out of the list and the total', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const { context, proposals, adminCaller } = await createReviewProposals(
      testData,
      ['Submitted', 'Draft'],
    );
    const [submitted, draft] = proposals;
    if (!submitted || !draft) {
      throw new Error('expected two proposals');
    }
    await db
      .update(proposalsTable)
      .set({ status: ProposalStatus.DRAFT })
      .where(eq(proposalsTable.id, draft.id));

    const result = await adminCaller.decision.listReviewProposals({
      processInstanceId: context.instance.instance.id,
    });

    expect(result.items.map((item) => item.id)).toEqual([submitted.id]);
    expect(result.total).toBe(1);
  });

  it('returns an empty list for a phase the instance has not reached', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const { context, adminCaller } = await createReviewProposals(testData, [
      'Review phase proposal',
    ]);

    const result = await adminCaller.decision.listReviewProposals({
      processInstanceId: context.instance.instance.id,
      phaseId: 'voting',
    });

    expect(result).toEqual({ items: [], next: null, total: 0 });
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

  it('rejects a caller with no access to the instance', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const [{ context }, otherContext] = await Promise.all([
      createReviewProposals(testData, ['Private proposal']),
      testData.createContext(),
    ]);
    const outsiderCaller = await createAuthenticatedCaller(
      otherContext.defaultReviewer.email,
    );

    await expect(
      outsiderCaller.decision.listReviewProposals({
        processInstanceId: context.instance.instance.id,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });

  describe('scope: assigned', () => {
    /**
     * A context with a REVIEW-only reviewer: `assignedTitles` are assigned to
     * them, `otherTitles` to the default reviewer, all in the review phase.
     */
    async function createAssignedContext({
      testData,
      assignedTitles,
      otherTitles = [],
    }: {
      testData: TestReviewsDataManager;
      assignedTitles: string[];
      otherTitles?: string[];
    }) {
      const context = await testData.createContext();
      const reviewer = await testData.createInstanceReviewerWithRole(context);
      const assigned = [];
      const other = [];
      // Sequential, so each proposal gets a later `createdAt`.
      for (const title of assignedTitles) {
        const { proposal } = await testData.createReviewAssignment({
          context,
          reviewer,
          title,
        });
        assigned.push(proposal);
      }
      for (const title of otherTitles) {
        const { proposal } = await testData.createReviewAssignment({
          context,
          title,
        });
        other.push(proposal);
      }
      const reviewerCaller = await createAuthenticatedCaller(reviewer.email);
      return { context, reviewer, assigned, other, reviewerCaller };
    }

    it('returns only the caller assigned proposals, with total and paging', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestReviewsDataManager(task.id, onTestFinished);
      const { context, assigned, reviewerCaller } = await createAssignedContext(
        {
          testData,
          assignedTitles: ['Mine one', 'Mine two', 'Mine three'],
          otherTitles: ['Theirs one', 'Theirs two'],
        },
      );
      await testData.setPhaseOpenReviews(
        context.instance.instance.id,
        'review',
        false,
      );

      const seen: string[] = [];
      let cursor: string | null = null;
      let pages = 0;
      do {
        const page: Awaited<
          ReturnType<typeof reviewerCaller.decision.listReviewProposals>
        > = await reviewerCaller.decision.listReviewProposals({
          processInstanceId: context.instance.instance.id,
          scope: 'assigned',
          limit: 2,
          cursor,
        });
        expect(page.total).toBe(3);
        seen.push(...page.items.map((item) => item.id));
        cursor = page.next;
        pages += 1;
      } while (cursor && pages < 10);

      expect(pages).toBe(2);
      expect(seen).toEqual(assigned.map((proposal) => proposal.id).reverse());
    });

    it('leaves the default scope listing every proposal', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestReviewsDataManager(task.id, onTestFinished);
      const { context, assigned, other } = await createAssignedContext({
        testData,
        assignedTitles: ['Mine'],
        otherTitles: ['Theirs'],
      });
      const adminCaller = await createAuthenticatedCaller(
        context.defaultReviewer.email,
      );

      const [defaultResult, assignedResult] = await Promise.all([
        adminCaller.decision.listReviewProposals({
          processInstanceId: context.instance.instance.id,
        }),
        adminCaller.decision.listReviewProposals({
          processInstanceId: context.instance.instance.id,
          scope: 'assigned',
        }),
      ]);

      expect(defaultResult.items.map((item) => item.id)).toEqual([
        other[0]?.id,
        assigned[0]?.id,
      ]);
      expect(defaultResult.total).toBe(2);
      // The admin's own assignments only.
      expect(assignedResult.items.map((item) => item.id)).toEqual([
        other[0]?.id,
      ]);
      expect(assignedResult.total).toBe(1);
    });

    it('matches assignments on the requested phase only', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestReviewsDataManager(task.id, onTestFinished);
      const { context, reviewer, assigned, other, reviewerCaller } =
        await createAssignedContext({
          testData,
          assignedTitles: ['Review phase'],
          otherTitles: ['Earlier phase'],
        });
      const [earlier] = other;
      if (!earlier) {
        throw new Error('expected a second proposal');
      }
      await db.insert(proposalReviewAssignments).values({
        processInstanceId: context.instance.instance.id,
        proposalId: earlier.id,
        reviewerProfileId: reviewer.profileId,
        phaseId: 'submission',
      });

      const [current, explicit] = await Promise.all([
        reviewerCaller.decision.listReviewProposals({
          processInstanceId: context.instance.instance.id,
          scope: 'assigned',
        }),
        reviewerCaller.decision.listReviewProposals({
          processInstanceId: context.instance.instance.id,
          phaseId: 'review',
          scope: 'assigned',
        }),
      ]);

      expect(current.items.map((item) => item.id)).toEqual([assigned[0]?.id]);
      expect(explicit.items.map((item) => item.id)).toEqual([assigned[0]?.id]);
    });

    it('combines with search and categoryIds', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestReviewsDataManager(task.id, onTestFinished);
      const { context, assigned, other, reviewerCaller } =
        await createAssignedContext({
          testData,
          assignedTitles: ['Garden tagged', 'Garden untagged', 'Library'],
          otherTitles: ['Garden not mine'],
        });
      const [tagged, untagged] = assigned;
      const [notMine] = other;
      if (!tagged || !untagged || !notMine) {
        throw new Error('expected four proposals');
      }
      const term = await createTerm('Parks', onTestFinished);
      await Promise.all([
        tagProposal(tagged.id, [term.id]),
        tagProposal(notMine.id, [term.id]),
      ]);

      const [searchResult, categoryResult] = await Promise.all([
        reviewerCaller.decision.listReviewProposals({
          processInstanceId: context.instance.instance.id,
          scope: 'assigned',
          search: 'garden',
        }),
        reviewerCaller.decision.listReviewProposals({
          processInstanceId: context.instance.instance.id,
          scope: 'assigned',
          categoryIds: [term.id],
        }),
      ]);

      expect(searchResult.items.map((item) => item.id)).toEqual([
        untagged.id,
        tagged.id,
      ]);
      expect(searchResult.total).toBe(2);
      expect(categoryResult.items.map((item) => item.id)).toEqual([tagged.id]);
      expect(categoryResult.total).toBe(1);
    });

    it('admits a reviewer without open reviews only under assigned', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestReviewsDataManager(task.id, onTestFinished);
      const { context, assigned, reviewerCaller } = await createAssignedContext(
        {
          testData,
          assignedTitles: ['Closed review'],
        },
      );
      await testData.setPhaseOpenReviews(
        context.instance.instance.id,
        'review',
        false,
      );

      const result = await reviewerCaller.decision.listReviewProposals({
        processInstanceId: context.instance.instance.id,
        scope: 'assigned',
      });

      expect(result.items.map((item) => item.id)).toEqual([assigned[0]?.id]);
      await expect(
        reviewerCaller.decision.listReviewProposals({
          processInstanceId: context.instance.instance.id,
          scope: 'all',
        }),
      ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
    });

    it('refuses a phase after the current one', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestReviewsDataManager(task.id, onTestFinished);
      const { context, reviewerCaller } = await createAssignedContext({
        testData,
        assignedTitles: ['Current phase'],
      });

      await expect(
        reviewerCaller.decision.listReviewProposals({
          processInstanceId: context.instance.instance.id,
          phaseId: 'voting',
          scope: 'assigned',
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
      const member = await testData.createInstanceMember(context);
      const memberCaller = await createAuthenticatedCaller(member.email);

      await expect(
        memberCaller.decision.listReviewProposals({
          processInstanceId: context.instance.instance.id,
          scope: 'assigned',
        }),
      ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
    });
  });
});
