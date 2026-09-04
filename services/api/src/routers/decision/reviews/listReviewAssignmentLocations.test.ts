import { db } from '@op/db/client';
import {
  ProposalRelationshipType,
  ProposalReviewAssignmentStatus,
  authUsers,
  proposalRelationships,
  proposals,
} from '@op/db/schema';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { TestReviewsDataManager } from '../../../test/helpers/TestReviewsDataManager';
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

/** Phase the fixtures pin assignments to (`createReviewScenario`'s default). */
const REVIEW_PHASE = 'review';

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

async function setLocation(
  proposalId: string,
  location: { lat: number; lng: number } | null,
) {
  await db
    .update(proposals)
    .set({ proposalData: { title: 'Located Proposal', location } })
    .where(eq(proposals.id, proposalId));
}

describe.concurrent('listReviewAssignmentLocations', () => {
  it('plots only the proposals the caller is assigned to review', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const mine = await testData.createReviewAssignment({ title: 'Mine' });
    const context = mine.context;

    const otherReviewer = await testData.createReviewer(context);
    const theirs = await testData.createReviewAssignment({
      context,
      reviewer: otherReviewer,
      title: 'Theirs',
    });
    const unlocated = await testData.createReviewAssignment({
      context,
      reviewer: mine.reviewer,
      title: 'Mine, no coordinates',
    });

    await Promise.all([
      setLocation(mine.proposal.id, { lat: 40.7, lng: -74 }),
      setLocation(theirs.proposal.id, { lat: 34, lng: -118.2 }),
      setLocation(unlocated.proposal.id, null),
    ]);

    const caller = await createAuthenticatedCaller(mine.reviewer.email);
    const result = await caller.decision.listReviewAssignmentLocations({
      processInstanceId: context.instance.instance.id,
      phaseId: REVIEW_PHASE,
    });

    expect(result.proposals.map((p) => p.id)).toEqual([mine.proposal.id]);
  });

  it('rejects a caller without review access on the instance', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({ title: 'Mine' });
    await setLocation(created.proposal.id, { lat: 40.7, lng: -74 });

    // The proposal's author is an instance member with read but not review.
    const authorCaller = await createAuthenticatedCaller(created.author.email);

    await expect(
      authorCaller.decision.listReviewAssignmentLocations({
        processInstanceId: created.context.instance.instance.id,
        phaseId: REVIEW_PHASE,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });

  it('plots only the assignments matching the status filter', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const pending = await testData.createReviewAssignment({
      title: 'Not started',
    });
    const context = pending.context;
    const completed = await testData.createReviewAssignment({
      context,
      reviewer: pending.reviewer,
      title: 'Already reviewed',
      status: ProposalReviewAssignmentStatus.COMPLETED,
    });

    await Promise.all([
      setLocation(pending.proposal.id, { lat: 40.7, lng: -74 }),
      setLocation(completed.proposal.id, { lat: 34, lng: -118.2 }),
    ]);

    const caller = await createAuthenticatedCaller(pending.reviewer.email);
    const input = {
      processInstanceId: context.instance.instance.id,
      phaseId: REVIEW_PHASE,
    };

    const onlyCompleted = await caller.decision.listReviewAssignmentLocations({
      ...input,
      status: ProposalReviewAssignmentStatus.COMPLETED,
    });
    const unfiltered =
      await caller.decision.listReviewAssignmentLocations(input);

    expect(onlyCompleted.proposals.map((p) => p.id)).toEqual([
      completed.proposal.id,
    ]);
    expect(unfiltered.proposals.map((p) => p.id).sort()).toEqual(
      [pending.proposal.id, completed.proposal.id].sort(),
    );
  });

  it('drops the pin of a proposal that was merged away, like the queue does', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const merged = await testData.createReviewAssignment({ title: 'Merged' });
    const context = merged.context;
    const survivor = await testData.createReviewAssignment({
      context,
      reviewer: merged.reviewer,
      title: 'Survivor',
    });
    const instanceId = context.instance.instance.id;

    await Promise.all([
      setLocation(merged.proposal.id, { lat: 40.7, lng: -74 }),
      setLocation(survivor.proposal.id, { lat: 34, lng: -118.2 }),
    ]);
    // The edge directly: what's under test is the read.
    await db.insert(proposalRelationships).values({
      processInstanceId: instanceId,
      sourceProposalId: merged.proposal.id,
      targetProposalId: survivor.proposal.id,
      relationshipType: ProposalRelationshipType.MERGED,
    });

    const caller = await createAuthenticatedCaller(merged.reviewer.email);
    const result = await caller.decision.listReviewAssignmentLocations({
      processInstanceId: instanceId,
      phaseId: REVIEW_PHASE,
    });

    expect(result.proposals.map((p) => p.id)).toEqual([survivor.proposal.id]);
  });

  it('marks an anonymous author on the pin', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({ title: 'Anon' });
    await setLocation(created.proposal.id, { lat: 40.7, lng: -74 });
    await db
      .update(authUsers)
      .set({ isAnonymous: true })
      .where(eq(authUsers.id, created.author.authUserId));

    const caller = await createAuthenticatedCaller(created.reviewer.email);
    const result = await caller.decision.listReviewAssignmentLocations({
      processInstanceId: created.context.instance.instance.id,
      phaseId: REVIEW_PHASE,
    });

    // Without the `profileUsers` join every author reads as not anonymous.
    expect(result.proposals[0]?.submittedBy).toMatchObject({
      isAnonymous: true,
    });
  });

  it('rejects a phaseId that does not exist on the instance', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();

    const reviewerCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    await expect(
      reviewerCaller.decision.listReviewAssignmentLocations({
        processInstanceId: context.instance.instance.id,
        phaseId: 'this-phase-does-not-exist',
      }),
    ).rejects.toMatchObject({ cause: { name: 'NotFoundError' } });
  });
});

describeDecisionAccessTierGating('listReviewAssignmentLocations', {
  noJwtNonPublic: accessTierGatingCell(
    'rejects no-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestReviewsDataManager(task.id, onTestFinished);
      const context = await testData.createContext();

      const caller = await callers.noJwt();

      await expectFailsAccessTierGate(
        caller.decision.listReviewAssignmentLocations({
          processInstanceId: context.instance.instance.id,
          phaseId: REVIEW_PHASE,
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
        caller.decision.listReviewAssignmentLocations({
          processInstanceId: context.instance.instance.id,
          phaseId: REVIEW_PHASE,
        }),
        'anon',
      );
    },
  ),

  userJwtNonPublic: accessTierGatingCell(
    'rejects out-of-network user-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestReviewsDataManager(task.id, onTestFinished);
      const context = await testData.createContext();

      const caller = await callers.userJwt();

      await expectFailsAccessTierGate(
        caller.decision.listReviewAssignmentLocations({
          processInstanceId: context.instance.instance.id,
          phaseId: REVIEW_PHASE,
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

      const result = await caller.decision.listReviewAssignmentLocations({
        processInstanceId: context.instance.instance.id,
        phaseId: REVIEW_PHASE,
      });
      expect(result.proposals).toBeDefined();
    },
  ),
});
