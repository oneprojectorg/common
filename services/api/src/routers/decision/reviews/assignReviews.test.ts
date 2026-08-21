import {
  ProposalReviewAssignmentStatus,
  ProposalStatus,
  proposals,
} from '@op/db/schema';
import { db } from '@op/db/test';
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

/** Narrows `cause.name` without a type assertion (the repo forbids `as`). */
function causeNameOf(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('cause' in error)) {
    return undefined;
  }
  const { cause } = error;
  if (typeof cause !== 'object' || cause === null || !('name' in cause)) {
    return undefined;
  }
  const { name } = cause;
  return typeof name === 'string' ? name : undefined;
}

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

/** One proposal, an instance admin (`defaultReviewer`), and a REVIEW member. */
async function createAssignSetup(
  taskId: string,
  onTestFinished: ConstructorParameters<typeof TestReviewsDataManager>[1],
) {
  const testData = new TestReviewsDataManager(taskId, onTestFinished);
  const created = await testData.createReviewAssignment({
    title: `Assignable proposal ${taskId}`,
    status: ProposalReviewAssignmentStatus.PENDING,
  });
  const context = created.context;
  await testData.setCurrentPhase(context.instance.instance.id, 'review');

  const reviewer = await testData.createInstanceReviewerWithRole(context);

  return {
    testData,
    context,
    processInstanceId: context.instance.instance.id,
    proposal: created.proposal,
    reviewer,
  };
}

describe.concurrent('decision.assignReviews', () => {
  it('creates assignments for an instance admin, idempotently', async ({
    task,
    onTestFinished,
  }) => {
    const { context, processInstanceId, proposal, reviewer } =
      await createAssignSetup(task.id, onTestFinished);

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const first = await adminCaller.decision.assignReviews({
      processInstanceId,
      phaseId: 'review',
      reviewerProfileId: reviewer.profileId,
      proposalIds: [proposal.id],
    });
    expect(first.createdCount).toBe(1);

    // Unique on instance × proposal × reviewer × phase.
    const second = await adminCaller.decision.assignReviews({
      processInstanceId,
      phaseId: 'review',
      reviewerProfileId: reviewer.profileId,
      proposalIds: [proposal.id],
    });
    expect(second.createdCount).toBe(0);

    const listing = await adminCaller.decision.listPhaseReviewAssignments({
      processInstanceId,
      phaseId: 'review',
    });

    const rollup = listing.reviewers.find(
      (candidate) => candidate.profile.id === reviewer.profileId,
    );
    expect(rollup?.assignedCount).toBe(1);
    expect(rollup?.assignments[0]?.proposalId).toBe(proposal.id);
  });

  it('rejects a reviewer who is not an instance admin', async ({
    task,
    onTestFinished,
  }) => {
    const { processInstanceId, proposal, reviewer } = await createAssignSetup(
      task.id,
      onTestFinished,
    );

    const reviewerCaller = await createAuthenticatedCaller(reviewer.email);

    await expect(
      reviewerCaller.decision.assignReviews({
        processInstanceId,
        phaseId: 'review',
        reviewerProfileId: reviewer.profileId,
        proposalIds: [proposal.id],
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });

  it('rejects a plain instance member', async ({ task, onTestFinished }) => {
    const { testData, context, processInstanceId, proposal, reviewer } =
      await createAssignSetup(task.id, onTestFinished);

    const member = await testData.createInstanceMember(context);
    const memberCaller = await createAuthenticatedCaller(member.email);

    await expect(
      memberCaller.decision.assignReviews({
        processInstanceId,
        phaseId: 'review',
        reviewerProfileId: reviewer.profileId,
        proposalIds: [proposal.id],
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });

  it('rejects a target without the REVIEW capability', async ({
    task,
    onTestFinished,
  }) => {
    const { testData, context, processInstanceId, proposal } =
      await createAssignSetup(task.id, onTestFinished);

    const member = await testData.createInstanceMember(context);
    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    await expect(
      adminCaller.decision.assignReviews({
        processInstanceId,
        phaseId: 'review',
        reviewerProfileId: member.profileId,
        proposalIds: [proposal.id],
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });
  });

  // ── Phase boundary ────────────────────────────────────────────────────

  it('rejects a draft proposal', async ({ task, onTestFinished }) => {
    const { context, processInstanceId, proposal, reviewer } =
      await createAssignSetup(task.id, onTestFinished);

    await db
      .update(proposals)
      .set({ status: ProposalStatus.DRAFT })
      .where(eq(proposals.id, proposal.id));

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    await expect(
      adminCaller.decision.assignReviews({
        processInstanceId,
        phaseId: 'review',
        reviewerProfileId: reviewer.profileId,
        proposalIds: [proposal.id],
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });
  });

  it('rejects a moderation-detached proposal', async ({
    task,
    onTestFinished,
  }) => {
    const { context, processInstanceId, proposal, reviewer } =
      await createAssignSetup(task.id, onTestFinished);

    // A CSAM verdict after the proposal entered the phase.
    await db
      .update(proposals)
      .set({ moderationDetachedAt: new Date().toISOString() })
      .where(eq(proposals.id, proposal.id));

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    await expect(
      adminCaller.decision.assignReviews({
        processInstanceId,
        phaseId: 'review',
        reviewerProfileId: reviewer.profileId,
        proposalIds: [proposal.id],
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });

    const listing = await adminCaller.decision.listPhaseReviewAssignments({
      processInstanceId,
      phaseId: 'review',
    });
    expect(listing.proposals.map((candidate) => candidate.id)).not.toContain(
      proposal.id,
    );
  });

  it('rejects a proposal assigned into a phase the instance has not reached', async ({
    task,
    onTestFinished,
  }) => {
    const { context, processInstanceId, proposal, reviewer } =
      await createAssignSetup(task.id, onTestFinished);

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    // After the current phase, so the completed-phase guard lets it through;
    // only the empty unreached-phase pool stops it.
    await expect(
      adminCaller.decision.assignReviews({
        processInstanceId,
        phaseId: 'voting',
        reviewerProfileId: reviewer.profileId,
        proposalIds: [proposal.id],
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });
  });

  it('rejects the whole request when only some ids are valid', async ({
    task,
    onTestFinished,
  }) => {
    const { context, processInstanceId, proposal, reviewer } =
      await createAssignSetup(task.id, onTestFinished);

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    await expect(
      adminCaller.decision.assignReviews({
        processInstanceId,
        phaseId: 'review',
        reviewerProfileId: reviewer.profileId,
        proposalIds: [proposal.id, crypto.randomUUID()],
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });

    // Atomic: the valid id must not have been assigned either.
    const listing = await adminCaller.decision.listPhaseReviewAssignments({
      processInstanceId,
      phaseId: 'review',
    });
    const rollup = listing.reviewers.find(
      (candidate) => candidate.profile.id === reviewer.profileId,
    );
    expect(rollup).toBeUndefined();
  });

  it('rejects a phaseId that does not exist on the instance', async ({
    task,
    onTestFinished,
  }) => {
    const { context, processInstanceId, proposal, reviewer } =
      await createAssignSetup(task.id, onTestFinished);

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    await expect(
      adminCaller.decision.assignReviews({
        processInstanceId,
        phaseId: 'this-phase-does-not-exist',
        reviewerProfileId: reviewer.profileId,
        proposalIds: [proposal.id],
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });
  });
});

describeDecisionAccessTierGating('decision.assignReviews', {
  noJwtNonPublic: accessTierGatingCell(
    'rejects no-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestReviewsDataManager(task.id, onTestFinished);
      const context = await testData.createContext();

      const caller = await callers.noJwt();

      await expectFailsAccessTierGate(
        caller.decision.assignReviews({
          processInstanceId: context.instance.instance.id,
          phaseId: 'review',
          reviewerProfileId: crypto.randomUUID(),
          proposalIds: [crypto.randomUUID()],
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
        caller.decision.assignReviews({
          processInstanceId: context.instance.instance.id,
          phaseId: 'review',
          reviewerProfileId: crypto.randomUUID(),
          proposalIds: [crypto.randomUUID()],
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
        caller.decision.assignReviews({
          processInstanceId: context.instance.instance.id,
          phaseId: 'review',
          reviewerProfileId: crypto.randomUUID(),
          proposalIds: [crypto.randomUUID()],
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

      // Past the admin gate, dying on the phase boundary — proves the call
      // reached the service.
      let caught: unknown;
      try {
        await caller.decision.assignReviews({
          processInstanceId: context.instance.instance.id,
          phaseId: 'review',
          reviewerProfileId: crypto.randomUUID(),
          proposalIds: [crypto.randomUUID()],
        });
      } catch (err) {
        caught = err;
      }
      expect(causeNameOf(caught)).toBe('ValidationError');
    },
  ),
});
