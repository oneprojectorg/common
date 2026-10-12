import {
  TestReviewsDataManager,
  createRevisionRequest,
} from '@op/common/testing';
import { db } from '@op/db/client';
import {
  ProposalReviewAssignmentStatus,
  contentTranslations,
} from '@op/db/schema';
import { like } from 'drizzle-orm';
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

async function createRevisionRequestScenario(
  testData: TestReviewsDataManager,
  onTestFinished: (fn: () => Promise<void>) => void,
) {
  const created = await testData.createReviewAssignment({
    title: 'Budget Proposal',
    status: ProposalReviewAssignmentStatus.AWAITING_AUTHOR_REVISION,
  });

  const request = await createRevisionRequest({
    assignmentId: created.assignment.id,
    requestComment: 'Please add a detailed budget breakdown.',
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

describe('translation.translateRevisionRequest', () => {
  it("translates the request comment for the proposal's author", async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const { author, request } = await createRevisionRequestScenario(
      testData,
      onTestFinished,
    );

    const caller = await createAuthenticatedCaller(author.email);
    const result = await caller.translation.translateRevisionRequest({
      requestId: request.id,
      targetLocale: 'es',
    });

    // No reviewer identity rides along.
    expect(result).toEqual({
      requestComment: '[ES] Please add a detailed budget breakdown.',
      sourceLocale: 'EN',
      targetLocale: 'es',
    });
  });

  it('translates the request comment for a decision admin', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const { reviewer, request } = await createRevisionRequestScenario(
      testData,
      onTestFinished,
    );

    // The default reviewer is the decision's admin.
    const caller = await createAuthenticatedCaller(reviewer.email);
    const result = await caller.translation.translateRevisionRequest({
      requestId: request.id,
      targetLocale: 'es',
    });

    expect(result.requestComment).toBe(
      '[ES] Please add a detailed budget breakdown.',
    );
  });

  it('rejects an instance member who is neither author, reviewer, nor admin', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const { context, request } = await createRevisionRequestScenario(
      testData,
      onTestFinished,
    );

    const member = await testData.createInstanceMember(context);
    const caller = await createAuthenticatedCaller(member.email);

    await expect(
      caller.translation.translateRevisionRequest({
        requestId: request.id,
        targetLocale: 'es',
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });

    expect(mockTranslateText).not.toHaveBeenCalled();
  });
});

describeAccessTierGating('translation.translateRevisionRequest', {
  noJwt: accessTierGatingCell('rejects no-JWT caller', async ({ callers }) => {
    const caller = await callers.noJwt();

    await expectFailsAccessTierGate(
      caller.translation.translateRevisionRequest({
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
        caller.translation.translateRevisionRequest({
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
        caller.translation.translateRevisionRequest({
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
        caller.translation.translateRevisionRequest({
          requestId: crypto.randomUUID(),
          targetLocale: 'es',
        }),
      );
    },
  ),
});
