import { createPostOnProfile } from '@op/common';
import { TestDecisionsDataManager } from '@op/common/testing';
import { db } from '@op/db/client';
import {
  ModerationFlagStatus,
  ModerationItemType,
  ModerationSource,
  ProposalStatus,
  contentTranslations,
  moderationFlags,
} from '@op/db/schema';
import { eq, like } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { appRouter } from '..';
import {
  accessTierGatingCell,
  describeAccessTierGating,
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

/** A decision with one proposal carrying one comment by the decision admin. */
async function createProposalComment(
  testData: TestDecisionsDataManager,
  onTestFinished: (fn: () => Promise<void>) => void,
  content: string,
) {
  const setup = await testData.createDecisionSetup({
    instanceCount: 1,
    grantAccess: true,
  });

  const proposal = await testData.createProposal({
    userEmail: setup.userEmail,
    processInstanceId: setup.instance.instance.id,
    proposalData: { title: 'Community Garden Expansion' },
    status: ProposalStatus.SUBMITTED,
  });

  const comment = await createPostOnProfile({
    content,
    targetProfileId: proposal.profileId,
    authUserId: setup.user.id,
  });

  onTestFinished(async () => {
    await db
      .delete(contentTranslations)
      .where(like(contentTranslations.contentKey, `post:${comment.id}:%`));
  });

  return { setup, proposal, comment };
}

describe('translation.translatePost', () => {
  it("translates a proposal comment's content", async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, comment } = await createProposalComment(
      testData,
      onTestFinished,
      'Love this idea for the neighbourhood.',
    );

    const caller = await createAuthenticatedCaller(setup.userEmail);
    const result = await caller.translation.translatePost({
      postId: comment.id,
      targetLocale: 'es',
    });

    expect(result).toEqual({
      content: '[ES] Love this idea for the neighbourhood.',
      sourceLocale: 'EN',
      targetLocale: 'es',
    });

    // Cached under the key `translatePosts` uses, so the two share rows.
    const cached = await db.query.contentTranslations.findFirst({
      where: { contentKey: `post:${comment.id}:content` },
    });
    expect(cached).toBeDefined();
  });

  it('translates a decision update for a member with READ access', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const adminCaller = await createAuthenticatedCaller(setup.userEmail);
    const update = await adminCaller.posts.createPost({
      content: 'Voting opens next week.',
      profileId: setup.instance.profileId,
    });

    onTestFinished(async () => {
      await db
        .delete(contentTranslations)
        .where(like(contentTranslations.contentKey, `post:${update.id}:%`));
    });

    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [setup.instance.profileId],
    });
    const memberCaller = await createAuthenticatedCaller(member.email);

    const result = await memberCaller.translation.translatePost({
      postId: update.id,
      targetLocale: 'es',
    });

    expect(result.content).toBe('[ES] Voting opens next week.');
  });

  it('rejects a caller without read access to the decision', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { comment } = await createProposalComment(
      testData,
      onTestFinished,
      'Members-only comment.',
    );

    // An admin of an unrelated decision — no grant on this one.
    const outsider = await testData.createDecisionSetup({
      instanceCount: 0,
    });
    const outsiderCaller = await createAuthenticatedCaller(outsider.userEmail);

    await expect(
      outsiderCaller.translation.translatePost({
        postId: comment.id,
        targetLocale: 'es',
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });

    const visitorCaller = createCaller(
      await createTestContextWithSession(null),
    );

    await expect(
      visitorCaller.translation.translatePost({
        postId: comment.id,
        targetLocale: 'es',
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });

    expect(mockTranslateText).not.toHaveBeenCalled();
  });

  it('hides a flagged comment from a non-admin non-author but not from an admin', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, comment } = await createProposalComment(
      testData,
      onTestFinished,
      'Flagged comment, hidden from non-admins.',
    );

    await db.insert(moderationFlags).values({
      itemType: ModerationItemType.POST,
      itemId: comment.id,
      status: ModerationFlagStatus.FLAGGED,
      source: ModerationSource.AUTOMATED,
      reason: 'translatePost test',
    });

    onTestFinished(async () => {
      await db
        .delete(moderationFlags)
        .where(eq(moderationFlags.itemId, comment.id));
    });

    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [setup.instance.profileId],
    });
    const memberCaller = await createAuthenticatedCaller(member.email);

    await expect(
      memberCaller.translation.translatePost({
        postId: comment.id,
        targetLocale: 'es',
      }),
    ).rejects.toMatchObject({ cause: { name: 'NotFoundError' } });

    expect(mockTranslateText).not.toHaveBeenCalled();

    const adminCaller = await createAuthenticatedCaller(setup.userEmail);
    const result = await adminCaller.translation.translatePost({
      postId: comment.id,
      targetLocale: 'es',
    });

    expect(result.content).toBe(
      '[ES] Flagged comment, hidden from non-admins.',
    );
  });
});

// openProcedure admits every tier past the gate; the service fails closed (see
// the access tests above).
describeAccessTierGating('translation.translatePost', {
  noJwt: accessTierGatingCell(
    'admits no-JWT caller past the tier gate',
    async ({ callers }) => {
      const caller = await callers.noJwt();
      await expectPassesAccessTierGate(
        caller.translation.translatePost({
          postId: crypto.randomUUID(),
          targetLocale: 'es',
        }),
      );
    },
  ),

  anonJwt: accessTierGatingCell(
    'admits anon-JWT caller past the tier gate',
    async ({ callers }) => {
      const caller = await callers.anonJwt();
      await expectPassesAccessTierGate(
        caller.translation.translatePost({
          postId: crypto.randomUUID(),
          targetLocale: 'es',
        }),
      );
    },
  ),

  userJwt: accessTierGatingCell(
    'admits out-of-network user-JWT caller past the tier gate',
    async ({ callers }) => {
      const caller = await callers.userJwt();
      await expectPassesAccessTierGate(
        caller.translation.translatePost({
          postId: crypto.randomUUID(),
          targetLocale: 'es',
        }),
      );
    },
  ),

  networkJwt: accessTierGatingCell(
    'admits network-JWT caller',
    async ({ callers }) => {
      const caller = await callers.networkJwt();
      await expectPassesAccessTierGate(
        caller.translation.translatePost({
          postId: crypto.randomUUID(),
          targetLocale: 'es',
        }),
      );
    },
  ),
});
