import { ProposalReviewAssignmentStatus } from '@op/db/schema';
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

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

describe.concurrent('decision.getReviewerAssignmentPool', () => {
  it('returns the phase pool and only this reviewer’s assignments', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: `Pool proposal ${task.id}`,
      status: ProposalReviewAssignmentStatus.PENDING,
    });
    const context = created.context;
    await testData.setCurrentPhase(context.instance.instance.id, 'review');

    const other = await testData.createInstanceReviewerWithRole(context);
    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );
    await adminCaller.decision.assignReviews({
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
      reviewerProfileId: other.profileId,
      proposalIds: [created.proposal.id],
    });

    const pool = await adminCaller.decision.getReviewerAssignmentPool({
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
      reviewerProfileId: other.profileId,
    });

    expect(pool.reviewer.id).toBe(other.profileId);
    expect(pool.isEligible).toBe(true);
    expect(pool.proposals.map((proposal) => proposal.id)).toContain(
      created.proposal.id,
    );
    // Both reviewers hold this proposal; the pool carries one row, theirs.
    expect(pool.assignments).toHaveLength(1);
    expect(pool.assignments[0]?.proposalId).toBe(created.proposal.id);
    expect(pool.assignments[0]?.status).toBe(
      ProposalReviewAssignmentStatus.PENDING,
    );
  });

  it('marks a member without the reviewer role as ineligible', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    const member = await testData.createInstanceMember(context);

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    // Drives the dialog's frozen state: unassign only, no new work.
    const pool = await adminCaller.decision.getReviewerAssignmentPool({
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
      reviewerProfileId: member.profileId,
    });

    expect(pool.isEligible).toBe(false);
    expect(pool.assignments).toEqual([]);
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
      reviewerCaller.decision.getReviewerAssignmentPool({
        processInstanceId: context.instance.instance.id,
        phaseId: 'review',
        reviewerProfileId: reviewer.profileId,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });
});

describeDecisionAccessTierGating('decision.getReviewerAssignmentPool', {
  noJwtNonPublic: accessTierGatingCell(
    'rejects no-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestReviewsDataManager(task.id, onTestFinished);
      const context = await testData.createContext();

      const caller = await callers.noJwt();

      await expectFailsAccessTierGate(
        caller.decision.getReviewerAssignmentPool({
          processInstanceId: context.instance.instance.id,
          phaseId: 'review',
          reviewerProfileId: context.defaultReviewer.profileId,
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
        caller.decision.getReviewerAssignmentPool({
          processInstanceId: context.instance.instance.id,
          phaseId: 'review',
          reviewerProfileId: context.defaultReviewer.profileId,
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
        caller.decision.getReviewerAssignmentPool({
          processInstanceId: context.instance.instance.id,
          phaseId: 'review',
          reviewerProfileId: context.defaultReviewer.profileId,
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

      const pool = await caller.decision.getReviewerAssignmentPool({
        processInstanceId: context.instance.instance.id,
        phaseId: 'review',
        reviewerProfileId: context.defaultReviewer.profileId,
      });

      expect(pool.assignments).toEqual([]);
    },
  ),
});
