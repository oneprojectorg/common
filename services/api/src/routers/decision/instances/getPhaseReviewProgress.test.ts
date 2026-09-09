import { computeDaysLeft } from '@op/common';
import {
  ProposalReviewAssignmentStatus,
  ProposalReviewState,
  processInstances,
  proposalReviewAssignments,
} from '@op/db/schema';
import { ROLES } from '@op/db/seedData/accessControl';
import { db } from '@op/db/test';
import { createProposalReview, testSimpleVotingSchema } from '@op/test';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
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

describe.concurrent('getPhaseReviewProgress', () => {
  it('rejects callers without admin access on the instance', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    const reviewer = await testData.createInstanceReviewerWithRole(context);

    const reviewerCaller = await createAuthenticatedCaller(reviewer.email);

    await expect(
      reviewerCaller.decision.getPhaseReviewProgress({
        processInstanceId: context.instance.instance.id,
        phaseId: 'review',
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });

  it('rejects an org admin with no grant on the instance profile', async ({
    task,
    onTestFinished,
  }) => {
    // The legacy org fallback (`assertInstanceProfileAccess`) still admits this
    // caller to `getInstance` — the read surface legacy results screens hit —
    // but the admin gate here resolves against the instance's own profile,
    // where an org admin holds nothing.
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      processSchema: testSimpleVotingSchema,
    });

    // The fixture owns instances by the creator's individual profile; the org
    // fallback only fires when the owner is an organization's profile.
    await db
      .update(processInstances)
      .set({ ownerProfileId: setup.organization.profileId })
      .where(eq(processInstances.id, setup.instance.instance.id));

    const orgAdmin = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [],
      orgRoleId: ROLES.ADMIN.id,
    });

    const orgAdminCaller = await createAuthenticatedCaller(orgAdmin.email);

    // Proof the caller is genuinely on the fallback path rather than simply
    // locked out everywhere: the instance read still admits them, and still
    // reports the org-derived admin bit to the client.
    await expect(
      orgAdminCaller.decision.getInstance({
        instanceId: setup.instance.instance.id,
      }),
    ).resolves.toMatchObject({ access: { admin: true } });

    await expect(
      orgAdminCaller.decision.getPhaseReviewProgress({
        processInstanceId: setup.instance.instance.id,
        phaseId: 'review',
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });

  it('rejects a phaseId that does not exist on the instance', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    await testData.setCurrentPhase(context.instance.instance.id, 'review');

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    await expect(
      adminCaller.decision.getPhaseReviewProgress({
        processInstanceId: context.instance.instance.id,
        phaseId: 'this-phase-does-not-exist',
      }),
    ).rejects.toMatchObject({ cause: { name: 'NotFoundError' } });
  });

  it('returns zero counts for an instance with no assignments', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    await testData.setCurrentPhase(context.instance.instance.id, 'review');

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.getPhaseReviewProgress({
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
    });

    expect(result).toEqual({
      proposalsReviewedCount: 0,
      proposalsTotalCount: 0,
      activeReviewersCount: 0,
      reviewersTotalCount: 0,
      daysLeft: null,
    });
  });

  it('counts a proposal as reviewed once any assignment is COMPLETED', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    await testData.setCurrentPhase(context.instance.instance.id, 'review');

    const [, mixed] = await Promise.all([
      testData.createReviewAssignment({
        context,
        title: 'All completed',
        status: ProposalReviewAssignmentStatus.COMPLETED,
      }),
      testData.createReviewAssignment({
        context,
        title: 'In progress',
        status: ProposalReviewAssignmentStatus.IN_PROGRESS,
      }),
      testData.createReviewAssignment({
        context,
        title: 'Pending',
        status: ProposalReviewAssignmentStatus.PENDING,
      }),
    ]);

    // Second reviewer on `mixed` is COMPLETED while the first is IN_PROGRESS —
    // proves a single COMPLETED assignment is enough to count as reviewed.
    const secondReviewer = await testData.createReviewer(context);
    await db.insert(proposalReviewAssignments).values({
      processInstanceId: context.instance.instance.id,
      proposalId: mixed.proposal.id,
      reviewerProfileId: secondReviewer.profileId,
      phaseId: 'review',
      status: ProposalReviewAssignmentStatus.COMPLETED,
    });

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.getPhaseReviewProgress({
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
    });

    expect(result.proposalsTotalCount).toBe(3);
    expect(result.proposalsReviewedCount).toBe(2);
  });

  it('counts active reviewers as those with at least one non-PENDING assignment', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    await testData.setCurrentPhase(context.instance.instance.id, 'review');

    await testData.createReviewAssignment({
      context,
      title: 'Active reviewer assignment',
      status: ProposalReviewAssignmentStatus.IN_PROGRESS,
    });

    const pendingOnlyReviewer = await testData.createReviewer(context);
    await testData.createReviewAssignment({
      context,
      title: 'Pending-only reviewer assignment',
      reviewer: pendingOnlyReviewer,
      status: ProposalReviewAssignmentStatus.PENDING,
    });

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.getPhaseReviewProgress({
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
    });

    expect(result.reviewersTotalCount).toBe(2);
    expect(result.activeReviewersCount).toBe(1);
  });

  it('treats AWAITING_AUTHOR_REVISION and READY_FOR_RE_REVIEW as active', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    await testData.setCurrentPhase(context.instance.instance.id, 'review');

    await testData.createReviewAssignment({
      context,
      title: 'Awaiting revision',
      status: ProposalReviewAssignmentStatus.AWAITING_AUTHOR_REVISION,
    });

    const reReviewReviewer = await testData.createReviewer(context);
    await testData.createReviewAssignment({
      context,
      title: 'Ready for re-review',
      reviewer: reReviewReviewer,
      status: ProposalReviewAssignmentStatus.READY_FOR_RE_REVIEW,
    });

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.getPhaseReviewProgress({
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
    });

    expect(result.activeReviewersCount).toBe(2);
    expect(result.reviewersTotalCount).toBe(2);
  });

  it('counts reviewers and assignments distinctly across multiple proposals', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    await testData.setCurrentPhase(context.instance.instance.id, 'review');

    await testData.createReviewAssignment({
      context,
      title: 'Proposal A',
      status: ProposalReviewAssignmentStatus.IN_PROGRESS,
    });
    await testData.createReviewAssignment({
      context,
      title: 'Proposal B',
      status: ProposalReviewAssignmentStatus.COMPLETED,
    });

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.getPhaseReviewProgress({
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
    });

    expect(result.reviewersTotalCount).toBe(1);
    expect(result.activeReviewersCount).toBe(1);
    expect(result.proposalsTotalCount).toBe(2);
    expect(result.proposalsReviewedCount).toBe(1);
  });

  it('scopes counts to the requested phase and ignores cross-phase assignments', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    await testData.setCurrentPhase(context.instance.instance.id, 'review');

    await testData.createReviewAssignment({
      context,
      title: 'Review phase',
      status: ProposalReviewAssignmentStatus.IN_PROGRESS,
    });

    // Distinct reviewer on a different phase must not leak into review-phase counts.
    const otherPhaseReviewer = await testData.createReviewer(context);
    const otherPhaseProposal = await testData.createReviewAssignment({
      context,
      title: 'Other phase',
      reviewer: otherPhaseReviewer,
      status: ProposalReviewAssignmentStatus.COMPLETED,
    });
    await db
      .update(proposalReviewAssignments)
      .set({ phaseId: 'submission' })
      .where(
        eq(proposalReviewAssignments.id, otherPhaseProposal.assignment.id),
      );

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.getPhaseReviewProgress({
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
    });

    expect(result.reviewersTotalCount).toBe(1);
    expect(result.activeReviewersCount).toBe(1);
  });

  it('isolates counts to the requested instance', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);

    const [primary, foreign] = await Promise.all([
      testData.createReviewAssignment({
        title: 'Primary',
        status: ProposalReviewAssignmentStatus.IN_PROGRESS,
      }),
      testData.createReviewAssignment({
        title: 'Foreign',
        status: ProposalReviewAssignmentStatus.COMPLETED,
      }),
    ]);

    await Promise.all([
      testData.setCurrentPhase(primary.context.instance.instance.id, 'review'),
      testData.setCurrentPhase(foreign.context.instance.instance.id, 'review'),
    ]);

    const adminCaller = await createAuthenticatedCaller(
      primary.context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.getPhaseReviewProgress({
      processInstanceId: primary.context.instance.instance.id,
      phaseId: 'review',
    });

    expect(result.proposalsTotalCount).toBe(1);
    expect(result.proposalsReviewedCount).toBe(0);
    expect(result.reviewersTotalCount).toBe(1);
    expect(result.activeReviewersCount).toBe(1);
  });

  it('returns daysLeft from the resolved phase endDate', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    await testData.setCurrentPhase(context.instance.instance.id, 'review');

    const tenDaysOut = new Date(Date.now() + 10 * 86_400_000).toISOString();
    await testData.setPhaseEndDate(
      context.instance.instance.id,
      'review',
      tenDaysOut,
    );

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.getPhaseReviewProgress({
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
    });

    // Rounding up — 10 days minus a few ms of test overhead still ceils to 10.
    expect(result.daysLeft).toBe(10);
  });

  it('returns null daysLeft when the phase has no endDate', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    await testData.setCurrentPhase(context.instance.instance.id, 'review');

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const result = await adminCaller.decision.getPhaseReviewProgress({
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
    });

    expect(result.daysLeft).toBeNull();
  });

  it('only flips proposalsReviewedCount when assignment status — not just review state — is COMPLETED', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext();
    await testData.setCurrentPhase(context.instance.instance.id, 'review');

    const created = await testData.createReviewAssignment({
      context,
      title: 'Submitted but not completed',
      status: ProposalReviewAssignmentStatus.IN_PROGRESS,
    });

    await createProposalReview({
      assignmentId: created.assignment.id,
      state: ProposalReviewState.SUBMITTED,
      reviewData: { answers: {}, rationales: {} },
      submittedAt: new Date().toISOString(),
    });

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const before = await adminCaller.decision.getPhaseReviewProgress({
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
    });
    expect(before.proposalsReviewedCount).toBe(0);
    expect(before.proposalsTotalCount).toBe(1);

    await db
      .update(proposalReviewAssignments)
      .set({ status: ProposalReviewAssignmentStatus.COMPLETED })
      .where(eq(proposalReviewAssignments.id, created.assignment.id));

    const after = await adminCaller.decision.getPhaseReviewProgress({
      processInstanceId: context.instance.instance.id,
      phaseId: 'review',
    });
    expect(after.proposalsReviewedCount).toBe(1);
  });
});

describe('computeDaysLeft', () => {
  const phases = [
    { phaseId: 'review', endDate: '2026-01-15T00:00:00.000Z' },
    { phaseId: 'no-end' },
  ];

  it('rounds up partial days', () => {
    expect(
      computeDaysLeft({
        phaseId: 'review',
        phases,
        now: new Date('2026-01-13T12:00:00.000Z'),
      }),
    ).toBe(2);
  });

  it('returns 0 when the deadline has passed', () => {
    expect(
      computeDaysLeft({
        phaseId: 'review',
        phases,
        now: new Date('2026-02-01T00:00:00.000Z'),
      }),
    ).toBe(0);
  });

  it('returns null when the resolved phase has no endDate', () => {
    expect(
      computeDaysLeft({
        phaseId: 'no-end',
        phases,
        now: new Date('2026-01-01T00:00:00.000Z'),
      }),
    ).toBeNull();
  });

  it('returns null when the phase is not in the phases array', () => {
    expect(
      computeDaysLeft({
        phaseId: 'unknown',
        phases,
        now: new Date('2026-01-01T00:00:00.000Z'),
      }),
    ).toBeNull();
  });
});

describeDecisionAccessTierGating('getPhaseReviewProgress', {
  noJwtNonPublic: accessTierGatingCell(
    'rejects no-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestReviewsDataManager(task.id, onTestFinished);
      const context = await testData.createContext();

      const caller = await callers.noJwt();

      await expectFailsAccessTierGate(
        caller.decision.getPhaseReviewProgress({
          processInstanceId: context.instance.instance.id,
          phaseId: 'review',
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
        caller.decision.getPhaseReviewProgress({
          processInstanceId: context.instance.instance.id,
          phaseId: 'review',
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
        caller.decision.getPhaseReviewProgress({
          processInstanceId: context.instance.instance.id,
          phaseId: 'review',
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

      // Passes the gate if the call resolves OR rejects with anything other
      // than UnauthorizedError.
      let caught: unknown;
      try {
        await caller.decision.getPhaseReviewProgress({
          processInstanceId: context.instance.instance.id,
          phaseId: 'review',
        });
      } catch (err) {
        caught = err;
      }
      expect((caught as { cause?: { name?: string } })?.cause?.name).not.toBe(
        'UnauthorizedError',
      );
    },
  ),
});
