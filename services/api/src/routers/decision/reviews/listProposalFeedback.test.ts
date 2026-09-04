import type { DecisionSchemaDefinition } from '@op/common';
import { ProposalReviewState, proposals } from '@op/db/schema';
import { db } from '@op/db/test';
import {
  createProposalReview,
  createReviewAssignment,
  grantDecisionProfileAccess,
} from '@op/test';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { TestReviewsDataManager } from '../../../test/helpers/TestReviewsDataManager';
import {
  accessTierGatingCell,
  describeAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../../test/helpers/gating';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../../test/supabase-utils';
import { createCallerFactory } from '../../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

/** Phases of `testSimpleVotingSchema`, which the reviews context uses. */
const REVIEW_PHASE = 'review';
const VOTING_PHASE = 'voting';

/** Two back-to-back review phases, for the multi-phase release-rule case. */
const FEASIBILITY_PHASE = 'feasibility';
const COMMUNITY_PHASE = 'community';

const twoReviewPhaseSchema = {
  id: 'feedback-phases',
  version: '1.0.0',
  name: 'Feedback Phases',
  description: 'Feasibility review followed by a community impact review.',
  phases: [
    {
      id: 'submission',
      name: 'Proposal Submission',
      rules: {
        proposals: { submit: true },
        advancement: { method: 'date' as const, endDate: '2026-01-01' },
      },
    },
    {
      id: FEASIBILITY_PHASE,
      name: 'Feasibility Review',
      rules: {
        reviews: { submit: true },
        advancement: { method: 'date' as const, endDate: '2026-01-02' },
      },
    },
    {
      id: COMMUNITY_PHASE,
      name: 'Community Impact Review',
      rules: {
        reviews: { submit: true },
        advancement: { method: 'date' as const, endDate: '2026-01-03' },
      },
    },
  ],
} satisfies DecisionSchemaDefinition;

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

describe.concurrent('listProposalFeedback', () => {
  it('returns reviewer notes from an ended review phase to the author', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: 'Ended Phase Feedback',
    });

    const review = await createProposalReview({
      assignmentId: created.assignment.id,
      state: ProposalReviewState.SUBMITTED,
      overallComment: 'Strong community benefit — tighten the timeline.',
      submittedAt: new Date().toISOString(),
    });

    // The instance has moved past the assignment's review phase, so the note
    // is final and released.
    await testData.setCurrentPhase(
      created.context.instance.instance.id,
      VOTING_PHASE,
    );

    const authorCaller = await createAuthenticatedCaller(created.author.email);
    const result = await authorCaller.decision.listProposalFeedback({
      proposalId: created.proposal.id,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe(review.id);
    expect(result.items[0]?.comment).toBe(
      'Strong community benefit — tighten the timeline.',
    );
    expect(result.items[0]?.phaseId).toBe(REVIEW_PHASE);
    // Anonymity is structural — no reviewer identity on the wire.
    expect(result.items[0]).not.toHaveProperty('reviewerProfileId');
  });

  it('returns nothing while the review phase is still current', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: 'Current Phase Feedback',
    });

    await createProposalReview({
      assignmentId: created.assignment.id,
      state: ProposalReviewState.SUBMITTED,
      overallComment: 'Reviewers can still edit this.',
      submittedAt: new Date().toISOString(),
    });

    await testData.setCurrentPhase(
      created.context.instance.instance.id,
      REVIEW_PHASE,
    );

    const authorCaller = await createAuthenticatedCaller(created.author.email);
    const result = await authorCaller.decision.listProposalFeedback({
      proposalId: created.proposal.id,
    });

    expect(result.items).toEqual([]);
  });

  it('returns reviewer notes to an invited co-author on the proposal', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: 'Co-authored Proposal',
    });

    const review = await createProposalReview({
      assignmentId: created.assignment.id,
      state: ProposalReviewState.SUBMITTED,
      overallComment: 'Both authors should read this.',
      submittedAt: new Date().toISOString(),
    });

    await testData.setCurrentPhase(
      created.context.instance.instance.id,
      VOTING_PHASE,
    );

    // A collaborator invited onto the proposal's own profile — what
    // `acceptProposalInvite` produces. Member role, not admin: plain
    // proposal-profile membership is what makes them an author here.
    const coAuthor = await testData.createInstanceMember(created.context);
    await grantDecisionProfileAccess({
      profileId: created.proposal.profileId,
      authUserId: coAuthor.authUserId,
      email: coAuthor.email,
      isAdmin: false,
    });

    const coAuthorCaller = await createAuthenticatedCaller(coAuthor.email);
    const result = await coAuthorCaller.decision.listProposalFeedback({
      proposalId: created.proposal.id,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe(review.id);
  });

  it('rejects an instance member who is neither the author, an admin, nor a reviewer', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: 'Members Should Not See',
    });

    await createProposalReview({
      assignmentId: created.assignment.id,
      state: ProposalReviewState.SUBMITTED,
      overallComment: 'Author-only feedback.',
      submittedAt: new Date().toISOString(),
    });

    await testData.setCurrentPhase(
      created.context.instance.instance.id,
      VOTING_PHASE,
    );

    const member = await testData.createInstanceMember(created.context);
    const memberCaller = await createAuthenticatedCaller(member.email);

    await expect(
      memberCaller.decision.listProposalFeedback({
        proposalId: created.proposal.id,
      }),
    ).rejects.toMatchObject({
      cause: { name: 'UnauthorizedError', statusCode: 403 },
    });
  });

  it('excludes draft reviews and blank comments', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: 'Noise Filtering',
    });

    // One review per assignment (unique constraint), so each case below needs
    // its own reviewer on the same proposal and phase.
    const submittedAt = new Date().toISOString();
    const cases = [
      // Draft — not final, not released even after the phase ends.
      { state: ProposalReviewState.DRAFT, overallComment: 'Still drafting.' },
      // Submitted, but with nothing to say.
      {
        state: ProposalReviewState.SUBMITTED,
        overallComment: '   ',
        submittedAt,
      },
      {
        state: ProposalReviewState.SUBMITTED,
        overallComment: null,
        submittedAt,
      },
    ];

    for (const reviewCase of cases) {
      const reviewer = await testData.createReviewer(created.context);
      const assignment = await createReviewAssignment({
        processInstanceId: created.context.instance.instance.id,
        proposalId: created.proposal.id,
        reviewerProfileId: reviewer.profileId,
        phaseId: REVIEW_PHASE,
      });
      await createProposalReview({
        assignmentId: assignment.id,
        ...reviewCase,
      });
    }

    const kept = await createProposalReview({
      assignmentId: created.assignment.id,
      state: ProposalReviewState.SUBMITTED,
      overallComment: 'The only note worth surfacing.',
      submittedAt,
    });

    await testData.setCurrentPhase(
      created.context.instance.instance.id,
      VOTING_PHASE,
    );

    const authorCaller = await createAuthenticatedCaller(created.author.email);
    const result = await authorCaller.decision.listProposalFeedback({
      proposalId: created.proposal.id,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe(kept.id);
  });

  it('releases notes phase by phase across two review phases', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext({
      processSchema: twoReviewPhaseSchema,
    });
    const created = await testData.createReviewAssignment({
      context,
      title: 'Two Review Phases',
      phaseId: FEASIBILITY_PHASE,
    });

    const feasibilityReview = await createProposalReview({
      assignmentId: created.assignment.id,
      state: ProposalReviewState.SUBMITTED,
      overallComment: 'Feasibility note — the phase is over.',
      submittedAt: new Date().toISOString(),
    });

    const communityAssignment = await createReviewAssignment({
      processInstanceId: context.instance.instance.id,
      proposalId: created.proposal.id,
      reviewerProfileId: created.reviewer.profileId,
      phaseId: COMMUNITY_PHASE,
    });
    await createProposalReview({
      assignmentId: communityAssignment.id,
      state: ProposalReviewState.SUBMITTED,
      overallComment: 'Community note — still editable.',
      submittedAt: new Date().toISOString(),
    });

    // Phase 2 is running: phase-1 notes are final, phase-2 notes are not.
    await testData.setCurrentPhase(
      context.instance.instance.id,
      COMMUNITY_PHASE,
    );

    const authorCaller = await createAuthenticatedCaller(created.author.email);
    const result = await authorCaller.decision.listProposalFeedback({
      proposalId: created.proposal.id,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.id).toBe(feasibilityReview.id);
    expect(result.items[0]?.phaseId).toBe(FEASIBILITY_PHASE);
  });

  it('returns 404 for a moderation-detached proposal', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const created = await testData.createReviewAssignment({
      title: 'Detached Proposal',
    });

    await createProposalReview({
      assignmentId: created.assignment.id,
      state: ProposalReviewState.SUBMITTED,
      overallComment: 'Should never reach the author.',
      submittedAt: new Date().toISOString(),
    });

    await testData.setCurrentPhase(
      created.context.instance.instance.id,
      VOTING_PHASE,
    );

    await db
      .update(proposals)
      .set({ moderationDetachedAt: new Date().toISOString() })
      .where(eq(proposals.id, created.proposal.id));

    const authorCaller = await createAuthenticatedCaller(created.author.email);

    await expect(
      authorCaller.decision.listProposalFeedback({
        proposalId: created.proposal.id,
      }),
    ).rejects.toMatchObject({ cause: { statusCode: 404 } });
  });
});

describeAccessTierGating('listProposalFeedback', {
  noJwt: accessTierGatingCell('rejects no-JWT caller', async ({ callers }) => {
    const caller = await callers.noJwt();

    await expectFailsAccessTierGate(
      caller.decision.listProposalFeedback({
        proposalId: crypto.randomUUID(),
      }),
      'none',
    );
  }),

  anonJwt: accessTierGatingCell(
    'admits anon-JWT past the tier gate',
    async ({ callers }) => {
      const caller = await callers.anonJwt();

      await expectPassesAccessTierGate(
        caller.decision.listProposalFeedback({
          proposalId: crypto.randomUUID(),
        }),
      );
    },
  ),

  userJwt: accessTierGatingCell(
    'admits out-of-network user-JWT past the tier gate',
    async ({ callers }) => {
      const caller = await callers.userJwt();

      await expectPassesAccessTierGate(
        caller.decision.listProposalFeedback({
          proposalId: crypto.randomUUID(),
        }),
      );
    },
  ),

  networkJwt: accessTierGatingCell(
    'admits network-JWT caller past the tier gate',
    async ({ callers }) => {
      const caller = await callers.networkJwt();

      await expectPassesAccessTierGate(
        caller.decision.listProposalFeedback({
          proposalId: crypto.randomUUID(),
        }),
      );
    },
  ),
});
