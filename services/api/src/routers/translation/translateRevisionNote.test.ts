import {
  TestReviewsDataManager,
  createRevisionRequest,
} from '@op/common/testing';
import { db } from '@op/db/client';
import {
  ProposalReviewAssignmentStatus,
  ProposalReviewRequestState,
  contentTranslations,
  proposals,
} from '@op/db/schema';
import { eq, like } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { appRouter } from '..';
import {
  accessTierGatingCell,
  describeAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../test/helpers/gating';
import { mockTranslateText } from '../../test/mocks/deepl';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../test/supabase-utils';
import { createCallerFactory } from '../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

async function createRevisionNoteScenario(
  testData: TestReviewsDataManager,
  onTestFinished: (fn: () => Promise<void>) => void,
  {
    state = ProposalReviewRequestState.RESUBMITTED,
    responseComment = 'I added the budget breakdown.',
  }: {
    state?: ProposalReviewRequestState;
    responseComment?: string;
  } = {},
) {
  const created = await testData.createReviewAssignment({
    title: 'Budget Proposal',
    status: ProposalReviewAssignmentStatus.READY_FOR_RE_REVIEW,
  });

  const request = await createRevisionRequest({
    assignmentId: created.assignment.id,
    state,
    requestComment: 'Please add a detailed budget breakdown.',
    responseComment,
  });

  onTestFinished(async () => {
    await db
      .delete(contentTranslations)
      .where(
        like(
          contentTranslations.contentKey,
          `revision_request:${request.id}:%`,
        ),
      );
  });

  return { ...created, request };
}

describe('translation.translateRevisionNote', () => {
  it("translates only the author's note for a decision admin", async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const { reviewer, request } = await createRevisionNoteScenario(
      testData,
      onTestFinished,
    );

    // The default reviewer is the decision's admin.
    const caller = await createAuthenticatedCaller(reviewer.email);
    const result = await caller.translation.translateRevisionNote({
      requestId: request.id,
      targetLocale: 'es',
    });

    expect(result).toEqual({
      responseComment: '[ES] I added the budget breakdown.',
      sourceLocale: 'EN',
      targetLocale: 'es',
    });
    // The reviewer's request text is not sent along.
    expect(mockTranslateText).toHaveBeenCalledTimes(1);
  });

  it("translates the note for the proposal's author", async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const { author, request } = await createRevisionNoteScenario(
      testData,
      onTestFinished,
    );

    const caller = await createAuthenticatedCaller(author.email);
    const result = await caller.translation.translateRevisionNote({
      requestId: request.id,
      targetLocale: 'es',
    });

    expect(result.responseComment).toBe('[ES] I added the budget breakdown.');
  });

  it('translates the note for a reviewer with the review capability but no admin role', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const { context, request } = await createRevisionNoteScenario(
      testData,
      onTestFinished,
    );

    const reviewer = await testData.createInstanceReviewerWithRole(context);
    const caller = await createAuthenticatedCaller(reviewer.email);
    const result = await caller.translation.translateRevisionNote({
      requestId: request.id,
      targetLocale: 'es',
    });

    expect(result.responseComment).toBe('[ES] I added the budget breakdown.');
  });

  it('returns no translation for a blank note without calling the provider', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const { author, request } = await createRevisionNoteScenario(
      testData,
      onTestFinished,
      { responseComment: '   ' },
    );

    const caller = await createAuthenticatedCaller(author.email);
    const result = await caller.translation.translateRevisionNote({
      requestId: request.id,
      targetLocale: 'es',
    });

    expect(result.responseComment).toBeUndefined();
    expect(result.sourceLocale).toBe('');
    expect(mockTranslateText).not.toHaveBeenCalled();
  });

  it('rejects a request the author has not resubmitted', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const { reviewer, request } = await createRevisionNoteScenario(
      testData,
      onTestFinished,
      { state: ProposalReviewRequestState.REQUESTED },
    );

    const caller = await createAuthenticatedCaller(reviewer.email);

    await expect(
      caller.translation.translateRevisionNote({
        requestId: request.id,
        targetLocale: 'es',
      }),
    ).rejects.toMatchObject({ cause: { name: 'NotFoundError' } });
    expect(mockTranslateText).not.toHaveBeenCalled();
  });

  it('rejects an admin of another decision', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const { request } = await createRevisionNoteScenario(
      testData,
      onTestFinished,
    );

    const otherData = new TestReviewsDataManager(
      `${task.id}-other`,
      onTestFinished,
    );
    const otherContext = await otherData.createContext();
    const caller = await createAuthenticatedCaller(
      otherContext.defaultReviewer.email,
    );

    await expect(
      caller.translation.translateRevisionNote({
        requestId: request.id,
        targetLocale: 'es',
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
    expect(mockTranslateText).not.toHaveBeenCalled();
  });

  it('hides the note of a proposal taken down by moderation, even from its author', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const { author, proposal, request } = await createRevisionNoteScenario(
      testData,
      onTestFinished,
    );

    await db
      .update(proposals)
      .set({ moderationDetachedAt: new Date().toISOString() })
      .where(eq(proposals.id, proposal.id));

    const caller = await createAuthenticatedCaller(author.email);

    await expect(
      caller.translation.translateRevisionNote({
        requestId: request.id,
        targetLocale: 'es',
      }),
    ).rejects.toMatchObject({ cause: { name: 'NotFoundError' } });
    expect(mockTranslateText).not.toHaveBeenCalled();
  });

  it('rejects an instance member who is neither author, reviewer, nor admin', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const { context, request } = await createRevisionNoteScenario(
      testData,
      onTestFinished,
    );

    const member = await testData.createInstanceMember(context);
    const caller = await createAuthenticatedCaller(member.email);

    await expect(
      caller.translation.translateRevisionNote({
        requestId: request.id,
        targetLocale: 'es',
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
    expect(mockTranslateText).not.toHaveBeenCalled();
  });
});

describeAccessTierGating('translation.translateRevisionNote', {
  noJwt: accessTierGatingCell('rejects no-JWT caller', async ({ callers }) => {
    const caller = await callers.noJwt();

    await expectFailsAccessTierGate(
      caller.translation.translateRevisionNote({
        requestId: crypto.randomUUID(),
        targetLocale: 'es',
      }),
      'none',
    );
  }),

  anonJwt: accessTierGatingCell(
    'admits anon-JWT past the tier gate',
    async ({ callers }) => {
      const caller = await callers.anonJwt();

      await expectPassesAccessTierGate(
        caller.translation.translateRevisionNote({
          requestId: crypto.randomUUID(),
          targetLocale: 'es',
        }),
      );
    },
  ),

  userJwt: accessTierGatingCell(
    'admits out-of-network user-JWT past the tier gate',
    async ({ callers }) => {
      const caller = await callers.userJwt();

      await expectPassesAccessTierGate(
        caller.translation.translateRevisionNote({
          requestId: crypto.randomUUID(),
          targetLocale: 'es',
        }),
      );
    },
  ),

  networkJwt: accessTierGatingCell(
    'admits network-JWT caller past the tier gate',
    async ({ callers }) => {
      const caller = await callers.networkJwt();

      await expectPassesAccessTierGate(
        caller.translation.translateRevisionNote({
          requestId: crypto.randomUUID(),
          targetLocale: 'es',
        }),
      );
    },
  ),
});
