import { mockCollab } from '@op/collab/testing';
import type {
  DecisionSchemaDefinition,
  RubricTemplateSchema,
} from '@op/common';
import { OVERALL_RECOMMENDATION_KEY } from '@op/common/client';
import { ProposalReviewState } from '@op/db/schema';
import { db } from '@op/db/test';
import { createProposalReview, createReviewAssignment } from '@op/test';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { TestReviewsDataManager } from '../../../test/helpers/TestReviewsDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../../test/supabase-utils';
import { createCallerFactory } from '../../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

/**
 * Per-phase rubric templates: two back-to-back review phases where the
 * feasibility phase carries its own rubric (phase-level field) while the
 * community phase falls back to the instance-level rubric. Covers assignment
 * context resolution, phase-scoped aggregates, submit/edit validation, and
 * the instance-level fallback.
 */

const FEASIBILITY_PHASE = 'feasibility';
const COMMUNITY_PHASE = 'community';

/** Instance-level rubric — what the community (current) phase reviews against. */
const instanceRubric: RubricTemplateSchema = {
  type: 'object',
  'x-field-order': ['impact', 'feasibility', OVERALL_RECOMMENDATION_KEY],
  properties: {
    impact: {
      type: 'integer',
      title: 'Impact',
      minimum: 0,
      maximum: 10,
    },
    feasibility: {
      type: 'integer',
      title: 'Feasibility',
      minimum: 1,
      maximum: 5,
    },
    [OVERALL_RECOMMENDATION_KEY]: {
      type: 'string',
      title: 'Recommendation',
      'x-format': 'dropdown',
      oneOf: [
        { const: 'yes', title: 'Yes' },
        { const: 'no', title: 'No' },
      ],
    },
  },
  required: ['impact'],
};

/** Feasibility phase's own rubric — different criteria, different max score. */
const feasibilityRubric: RubricTemplateSchema = {
  type: 'object',
  'x-field-order': ['viability'],
  properties: {
    viability: {
      type: 'integer',
      title: 'Viability',
      minimum: 1,
      maximum: 3,
    },
  },
  required: ['viability'],
};

const twoReviewPhaseSchema = {
  id: 'phase-rubrics',
  version: '1.0.0',
  name: 'Phase Rubrics',
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
        reviews: { submit: true, openReviews: true },
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

/** getReviewAssignment resolves the proposal's collab doc — stub its content. */
function seedMockCollab(proposal: { proposalData: unknown }) {
  const { collaborationDocId } = proposal.proposalData as {
    collaborationDocId: string;
  };
  mockCollab.setDocResponse(collaborationDocId, {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Phase rubric proposal content' }],
      },
    ],
  });
}

/**
 * Instance on the community phase: instance-level rubric set, feasibility
 * phase carrying its own rubric override.
 */
async function createTwoRubricContext(testData: TestReviewsDataManager) {
  const context = await testData.createContext({
    processSchema: twoReviewPhaseSchema,
  });
  const instanceId = context.instance.instance.id;
  await testData.setRubricTemplate(context, instanceRubric);
  await testData.setPhaseRubricTemplate(
    instanceId,
    FEASIBILITY_PHASE,
    feasibilityRubric,
  );
  await testData.setCurrentPhase(instanceId, COMMUNITY_PHASE);
  return context;
}

describe.concurrent('per-phase rubric templates', () => {
  it('resolves the assignment-phase rubric in the review assignment context', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await createTwoRubricContext(testData);

    const feasibilityScenario = await testData.createReviewAssignment({
      context,
      title: 'Assignment-phase rubric',
      phaseId: FEASIBILITY_PHASE,
    });
    const communityReviewer =
      await testData.createInstanceReviewerWithRole(context);
    const communityAssignment = await createReviewAssignment({
      processInstanceId: context.instance.instance.id,
      proposalId: feasibilityScenario.proposal.id,
      reviewerProfileId: communityReviewer.profileId,
      phaseId: COMMUNITY_PHASE,
    });
    seedMockCollab(feasibilityScenario.proposal);

    const feasibilityCaller = await createAuthenticatedCaller(
      feasibilityScenario.reviewer.email,
    );
    const feasibilityResult =
      await feasibilityCaller.decision.getReviewAssignment({
        assignmentId: feasibilityScenario.assignment.id,
      });
    expect(feasibilityResult.rubricTemplate).toMatchObject({
      properties: { viability: { title: 'Viability' } },
    });

    const communityCaller = await createAuthenticatedCaller(
      communityReviewer.email,
    );
    const communityResult = await communityCaller.decision.getReviewAssignment({
      assignmentId: communityAssignment.id,
    });
    // No phase-level rubric on the community phase → instance-level fallback.
    expect(communityResult.rubricTemplate).toMatchObject({
      properties: { impact: { title: 'Impact' } },
    });
  });

  it('resolves the rubric per assignment in listReviewAssignments', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await createTwoRubricContext(testData);

    // The same reviewer holds one assignment in each phase.
    const reviewer = await testData.createInstanceReviewerWithRole(context);
    const feasibilityScenario = await testData.createReviewAssignment({
      context,
      reviewer,
      title: 'Per-assignment rubric',
      phaseId: FEASIBILITY_PHASE,
    });
    const communityAssignment = await createReviewAssignment({
      processInstanceId: context.instance.instance.id,
      proposalId: feasibilityScenario.proposal.id,
      reviewerProfileId: reviewer.profileId,
      phaseId: COMMUNITY_PHASE,
    });

    const reviewerCaller = await createAuthenticatedCaller(reviewer.email);
    // The queue is phase-scoped, so each phase is listed on its own.
    const feasibilityList = await reviewerCaller.decision.listReviewAssignments(
      {
        processInstanceId: context.instance.instance.id,
        phaseId: FEASIBILITY_PHASE,
      },
    );
    expect(feasibilityList.assignments.map((a) => a.assignment.id)).toEqual([
      feasibilityScenario.assignment.id,
    ]);
    expect(feasibilityList.assignments[0]?.rubricTemplate).toMatchObject({
      properties: { viability: { title: 'Viability' } },
    });

    // Community is current, so the default scope lands there.
    const communityList = await reviewerCaller.decision.listReviewAssignments({
      processInstanceId: context.instance.instance.id,
    });
    expect(communityList.assignments.map((a) => a.assignment.id)).toEqual([
      communityAssignment.id,
    ]);
    expect(communityList.assignments[0]?.rubricTemplate).toMatchObject({
      properties: { impact: { title: 'Impact' } },
    });
  });

  it('returns phase-scoped aggregates scored against that phase’s rubric', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await createTwoRubricContext(testData);
    const instanceId = context.instance.instance.id;

    const feasibilityScenario = await testData.createReviewAssignment({
      context,
      title: 'Phase-scoped rubric aggregates',
      phaseId: FEASIBILITY_PHASE,
    });
    await createProposalReview({
      assignmentId: feasibilityScenario.assignment.id,
      state: ProposalReviewState.SUBMITTED,
      reviewData: {
        answers: { viability: 3 },
        rationales: {},
      },
      submittedAt: new Date().toISOString(),
    });

    const communityReviewer = await testData.createReviewer(context);
    const communityAssignment = await createReviewAssignment({
      processInstanceId: instanceId,
      proposalId: feasibilityScenario.proposal.id,
      reviewerProfileId: communityReviewer.profileId,
      phaseId: COMMUNITY_PHASE,
    });
    await createProposalReview({
      assignmentId: communityAssignment.id,
      state: ProposalReviewState.SUBMITTED,
      reviewData: {
        answers: {
          impact: 7,
          feasibility: 4,
          [OVERALL_RECOMMENDATION_KEY]: 'yes',
        },
        rationales: {},
      },
      submittedAt: new Date().toISOString(),
    });

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    // Feasibility phase: its own rubric, score = viability alone.
    const feasibilityResult =
      await adminCaller.decision.getProposalWithReviewAggregates({
        processInstanceId: instanceId,
        proposalId: feasibilityScenario.proposal.id,
        phaseId: FEASIBILITY_PHASE,
      });
    expect(feasibilityResult.rubricTemplate).toMatchObject({
      properties: { viability: { title: 'Viability' } },
    });
    expect(feasibilityResult.aggregates.averageScore).toBe(3);
    expect(feasibilityResult.reviews).toHaveLength(1);
    expect(feasibilityResult.reviews[0]!.score).toBe(3);

    // Community phase: instance-level fallback, score = impact + feasibility.
    const communityResult =
      await adminCaller.decision.getProposalWithReviewAggregates({
        processInstanceId: instanceId,
        proposalId: feasibilityScenario.proposal.id,
        phaseId: COMMUNITY_PHASE,
      });
    expect(communityResult.rubricTemplate).toMatchObject({
      properties: { impact: { title: 'Impact' } },
    });
    expect(communityResult.aggregates.averageScore).toBe(11);
    expect(communityResult.reviews[0]!.overallRecommendation).toBe('yes');

    // Admin omitting phaseId blends phases; the documented behavior is the
    // instance-level rubric, so the feasibility review scores 0 against it.
    const blendedResult =
      await adminCaller.decision.getProposalWithReviewAggregates({
        processInstanceId: instanceId,
        proposalId: feasibilityScenario.proposal.id,
      });
    expect(blendedResult.rubricTemplate).toMatchObject({
      properties: { impact: { title: 'Impact' } },
    });
    expect(blendedResult.aggregates.reviewsSubmittedCount).toBe(2);
    expect(blendedResult.aggregates.averageScore).toBe(5.5);

    // The list endpoint carries the same phase-resolved rubric, so clients
    // never resolve one themselves (e.g. shortlist total points).
    const feasibilityList = await adminCaller.decision.listWithReviewAggregates(
      {
        processInstanceId: instanceId,
        phaseId: FEASIBILITY_PHASE,
      },
    );
    expect(feasibilityList.rubricTemplate).toMatchObject({
      properties: { viability: { title: 'Viability' } },
    });

    // Effective phase defaults to the current (community) phase → fallback.
    const currentPhaseList =
      await adminCaller.decision.listWithReviewAggregates({
        processInstanceId: instanceId,
      });
    expect(currentPhaseList.rubricTemplate).toMatchObject({
      properties: { impact: { title: 'Impact' } },
    });
  });

  it('validates submissions against the assignment-phase rubric', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await createTwoRubricContext(testData);

    const scenario = await testData.createReviewAssignment({
      context,
      title: 'Submit against phase rubric',
      phaseId: FEASIBILITY_PHASE,
    });
    const reviewerCaller = await createAuthenticatedCaller(
      scenario.reviewer.email,
    );

    // Valid under the instance rubric, but not under the phase's own rubric.
    await expect(
      reviewerCaller.decision.submitReview({
        assignmentId: scenario.assignment.id,
        reviewData: { answers: { impact: 3 }, rationales: {} },
      }),
    ).rejects.toThrow('Rubric validation failed');

    const result = await reviewerCaller.decision.submitReview({
      assignmentId: scenario.assignment.id,
      reviewData: { answers: { viability: 2 }, rationales: {} },
    });
    expect(result.state).toBe(ProposalReviewState.SUBMITTED);
    expect(result.reviewData.answers).toEqual({ viability: 2 });
  });

  it('validates edits of a submitted review against the assignment-phase rubric', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await createTwoRubricContext(testData);
    const instanceId = context.instance.instance.id;
    // Editing is only allowed while the assignment's phase is current.
    await testData.setCurrentPhase(instanceId, FEASIBILITY_PHASE);

    const scenario = await testData.createReviewAssignment({
      context,
      title: 'Edit against phase rubric',
      phaseId: FEASIBILITY_PHASE,
    });
    const reviewerCaller = await createAuthenticatedCaller(
      scenario.reviewer.email,
    );

    await reviewerCaller.decision.submitReview({
      assignmentId: scenario.assignment.id,
      reviewData: { answers: { viability: 1 }, rationales: {} },
    });

    await expect(
      reviewerCaller.decision.updateReview({
        assignmentId: scenario.assignment.id,
        reviewData: { answers: { impact: 5 }, rationales: {} },
      }),
    ).rejects.toThrow('Rubric validation failed');

    const updated = await reviewerCaller.decision.updateReview({
      assignmentId: scenario.assignment.id,
      reviewData: { answers: { viability: 3 }, rationales: {} },
    });
    expect(updated.reviewData.answers).toEqual({ viability: 3 });
  });

  it('sets, validates, and clears a phase rubric through updateDecisionInstance', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext({
      processSchema: twoReviewPhaseSchema,
    });
    const instanceId = context.instance.instance.id;
    await testData.setRubricTemplate(context, instanceRubric);

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );

    const currentPhases = async () => {
      const row = await db.query.processInstances.findFirst({
        where: { id: instanceId },
      });
      const data = row?.instanceData as {
        phases: Array<{ phaseId: string; rubricTemplate?: unknown }>;
      };
      return data.phases;
    };
    const phaseIds = (await currentPhases()).map((p) => p.phaseId);

    // An invalid phase rubric (uncompilable regex pattern) is rejected
    // before anything persists.
    const uncompilableRubric: RubricTemplateSchema = {
      type: 'object',
      properties: { broken: { type: 'string', pattern: '[' } },
    };
    await expect(
      adminCaller.decision.updateDecisionInstance({
        instanceId,
        phases: phaseIds.map((phaseId) =>
          phaseId === FEASIBILITY_PHASE
            ? { phaseId, rubricTemplate: uncompilableRubric }
            : { phaseId },
        ),
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });

    // Set the feasibility phase's rubric; other phases stay untouched.
    await adminCaller.decision.updateDecisionInstance({
      instanceId,
      phases: phaseIds.map((phaseId) =>
        phaseId === FEASIBILITY_PHASE
          ? { phaseId, rubricTemplate: feasibilityRubric }
          : { phaseId },
      ),
    });

    let phases = await currentPhases();
    expect(
      phases.find((p) => p.phaseId === FEASIBILITY_PHASE)?.rubricTemplate,
    ).toMatchObject({ properties: { viability: { title: 'Viability' } } });
    expect(
      phases.find((p) => p.phaseId === COMMUNITY_PHASE)?.rubricTemplate,
    ).toBeUndefined();

    // An update that doesn't mention rubricTemplate leaves it in place.
    await adminCaller.decision.updateDecisionInstance({
      instanceId,
      phases: phaseIds.map((phaseId) => ({ phaseId, name: `n-${phaseId}` })),
    });
    phases = await currentPhases();
    expect(
      phases.find((p) => p.phaseId === FEASIBILITY_PHASE)?.rubricTemplate,
    ).toMatchObject({ properties: { viability: { title: 'Viability' } } });

    // `null` clears the phase rubric — back to the instance-level fallback.
    await adminCaller.decision.updateDecisionInstance({
      instanceId,
      phases: phaseIds.map((phaseId) =>
        phaseId === FEASIBILITY_PHASE
          ? { phaseId, rubricTemplate: null }
          : { phaseId },
      ),
    });
    phases = await currentPhases();
    expect(
      phases.find((p) => p.phaseId === FEASIBILITY_PHASE)?.rubricTemplate,
    ).toBeUndefined();
  });

  it('uses the instance rubric for every phase when none carries its own', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestReviewsDataManager(task.id, onTestFinished);
    const context = await testData.createContext({
      processSchema: twoReviewPhaseSchema,
    });
    const instanceId = context.instance.instance.id;
    await testData.setRubricTemplate(context, instanceRubric);
    await testData.setCurrentPhase(instanceId, COMMUNITY_PHASE);

    const scenario = await testData.createReviewAssignment({
      context,
      title: 'Instance-level fallback parity',
      phaseId: FEASIBILITY_PHASE,
    });
    await createProposalReview({
      assignmentId: scenario.assignment.id,
      state: ProposalReviewState.SUBMITTED,
      reviewData: {
        answers: { impact: 7, feasibility: 4 },
        rationales: {},
      },
      submittedAt: new Date().toISOString(),
    });

    seedMockCollab(scenario.proposal);
    const reviewerCaller = await createAuthenticatedCaller(
      scenario.reviewer.email,
    );
    const assignmentResult = await reviewerCaller.decision.getReviewAssignment({
      assignmentId: scenario.assignment.id,
    });
    expect(assignmentResult.rubricTemplate).toMatchObject({
      properties: { impact: { title: 'Impact' } },
    });

    const adminCaller = await createAuthenticatedCaller(
      context.defaultReviewer.email,
    );
    const aggregates =
      await adminCaller.decision.getProposalWithReviewAggregates({
        processInstanceId: instanceId,
        proposalId: scenario.proposal.id,
        phaseId: FEASIBILITY_PHASE,
      });
    expect(aggregates.rubricTemplate).toMatchObject({
      properties: { impact: { title: 'Impact' } },
    });
    expect(aggregates.aggregates.averageScore).toBe(11);
  });
});
