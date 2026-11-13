import { mockCollab, textFragment } from '@op/collab/testing';
import {
  TEST_PERMISSION_BITS,
  TestDecisionsDataManager,
  createProposalReview,
  createReviewAssignment,
  grantInstanceRole,
} from '@op/common/testing';
import { db } from '@op/db/client';
import {
  ProposalReviewState,
  ProposalStatus,
  processInstances,
} from '@op/db/schema';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import type { MappingRule } from '../../schemaMapping';
import { NotFoundError, UnauthorizedError, ValidationError } from '../../utils';
import { getDevelopPrefill } from './getDevelopPrefill';
import { parseProposalData } from './proposalDataSchema';
import type { DecisionSchemaDefinition } from './schemas/types';

const SUBMISSION = 'submission';
const FEASIBILITY = 'feasibility';
const EQUITY = 'equity';
const BALLOT = 'ballot';

const closedPhaseRules = {
  proposals: { submit: false },
  voting: { submit: false },
};

const developSchema = {
  id: 'develop-prefill',
  version: '1.0.0',
  name: 'Develop prefill',
  description: 'Submission, two review phases, and a phase that develops',
  phases: [
    {
      id: SUBMISSION,
      name: 'Submission',
      rules: { proposals: { submit: true }, voting: { submit: false } },
    },
    { id: FEASIBILITY, name: 'Feasibility review', rules: closedPhaseRules },
    { id: EQUITY, name: 'Equity review', rules: closedPhaseRules },
    { id: BALLOT, name: 'Ballot development', rules: closedPhaseRules },
  ],
} satisfies DecisionSchemaDefinition;

const locationField = {
  type: 'object',
  'x-format': 'location',
  properties: { lat: { type: 'number' }, lng: { type: 'number' } },
} as const;

const moneyField = {
  type: 'object',
  'x-format': 'money',
  properties: {
    amount: { type: 'number' },
    currency: { type: 'string', default: 'USD' },
  },
} as const;

const GENERATED_KEY = 'f0a8a062';

const submissionForm = {
  type: 'object',
  'x-field-order': ['title', 'summary', 'location', GENERATED_KEY],
  properties: {
    title: { type: 'string', 'x-format': 'short-text' },
    summary: { type: 'string', 'x-format': 'long-text' },
    location: locationField,
    [GENERATED_KEY]: { type: 'string', 'x-format': 'short-text' },
  },
} as const;

const feasibilityRubric = {
  type: 'object',
  properties: {
    cost_design: moneyField,
    cost_construction: moneyField,
    cost_contingency: moneyField,
    __overall_recommendation: { type: 'string' },
  },
} as const;

const equityRubric = {
  type: 'object',
  properties: {
    score_need: { type: 'integer' },
    score_reach: { type: 'integer' },
    __overall_recommendation: { type: 'string' },
  },
} as const;

const ballotForm = {
  type: 'object',
  'x-field-order': ['title', 'location', 'budget', 'description'],
  properties: {
    title: { type: 'string', 'x-format': 'short-text' },
    location: locationField,
    budget: moneyField,
    description: { type: 'string', 'x-format': 'long-text' },
  },
} as const;

const submissionRef = { type: 'proposal', phaseId: SUBMISSION } as const;
const feasibilityRef = { type: 'review', phaseId: FEASIBILITY } as const;
const ballotRef = { type: 'proposal', phaseId: BALLOT } as const;

const rules: MappingRule[] = [
  {
    sourceSchema: submissionRef,
    targetSchema: ballotRef,
    targetPointer: '/title',
    value: { pointer: '/title' },
  },
  {
    sourceSchema: submissionRef,
    targetSchema: ballotRef,
    targetPointer: '/location',
    value: { pointer: '/location' },
  },
  {
    sourceSchema: submissionRef,
    targetSchema: ballotRef,
    targetPointer: '/description',
    value: { pointer: '/summary' },
  },
  {
    sourceSchema: feasibilityRef,
    targetSchema: ballotRef,
    targetPointer: '/budget/amount',
    value: {
      function: 'sum',
      arguments: [
        { pointer: '/cost_design/amount' },
        { pointer: '/cost_construction/amount' },
        { pointer: '/cost_contingency/amount' },
      ],
    },
  },
];

const costs = ({
  design,
  construction,
  contingency,
}: {
  design: number;
  construction: number;
  contingency: number;
}) => ({
  cost_design: { amount: design, currency: 'USD' },
  cost_construction: { amount: construction, currency: 'USD' },
  cost_contingency: { amount: contingency, currency: 'USD' },
  __overall_recommendation: 'feasible',
});

const equityScores = {
  score_need: 4,
  score_reach: 3,
  __overall_recommendation: 'recommended',
};

const expectRejection = async ({
  promise,
  errorClass,
  message,
}: {
  promise: Promise<unknown>;
  errorClass: typeof ValidationError | typeof NotFoundError;
  message: string;
}) => {
  const error = await promise.then(
    () => undefined,
    (rejection: unknown) => rejection,
  );
  expect(error).toBeInstanceOf(errorClass);
  expect(error).toHaveProperty('message', message);
};

const seedDevelopDecision = async (testData: TestDecisionsDataManager) => {
  const setup = await testData.createDecisionSetup({
    instanceCount: 2,
    grantAccess: true,
    processSchema: developSchema,
    proposalTemplate: submissionForm,
  });
  const [instance, otherInstance] = setup.instances;
  if (!instance || !otherInstance) {
    throw new Error('Expected two instances');
  }

  const phaseTemplates: Record<string, object> = {
    [FEASIBILITY]: { rubricTemplate: feasibilityRubric },
    [EQUITY]: { rubricTemplate: equityRubric },
    [BALLOT]: { proposalTemplate: ballotForm },
  };
  const { instanceData } = instance.instance;
  await db
    .update(processInstances)
    .set({
      instanceData: {
        ...instanceData,
        proposalTemplate: submissionForm,
        phases: instanceData.phases.map((phase) => ({
          ...phase,
          ...phaseTemplates[phase.phaseId],
        })),
      },
    })
    .where(eq(processInstances.id, instance.instance.id));

  const adminUser = await db.query.users.findFirst({
    where: { authUserId: setup.user.id },
    columns: { profileId: true },
  });
  if (!adminUser?.profileId) {
    throw new Error('Expected the admin user to have a profile');
  }
  const adminProfileId = adminUser.profileId;
  const reviewerProfileIds = [adminProfileId, setup.organization.profileId];

  const createSubmittedProposal = async ({
    title,
    processInstanceId = instance.instance.id,
  }: {
    title: string;
    processInstanceId?: string;
  }) => {
    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId,
      proposalData: { title },
      status: ProposalStatus.SUBMITTED,
    });
    const { collaborationDocId } = parseProposalData(proposal.proposalData);
    if (!collaborationDocId) {
      throw new Error(`Proposal ${proposal.id} has no collaboration document`);
    }
    mockCollab.setDocFragmentResponses(collaborationDocId, {
      title: textFragment(title),
      summary: textFragment(`Summary of ${title}`),
      location: textFragment(JSON.stringify({ lat: 39.96, lng: -83 })),
      [GENERATED_KEY]: textFragment('Generated answer'),
    });
    return proposal;
  };

  const createReview = async ({
    proposalId,
    phaseId,
    reviewData,
    reviewer = 0,
    state = ProposalReviewState.SUBMITTED,
  }: {
    proposalId: string;
    phaseId: string;
    reviewData: Record<string, unknown>;
    reviewer?: 0 | 1;
    state?: ProposalReviewState;
  }) => {
    const assignment = await createReviewAssignment({
      processInstanceId: instance.instance.id,
      proposalId,
      reviewerProfileId: reviewerProfileIds[reviewer] ?? adminProfileId,
      phaseId,
    });
    return createProposalReview({
      assignmentId: assignment.id,
      state,
      reviewData,
    });
  };

  return {
    setup,
    instanceId: instance.instance.id,
    instanceProfileId: instance.profileId,
    otherInstanceId: otherInstance.instance.id,
    createSubmittedProposal,
    createReview,
  };
};

describe.concurrent('getDevelopPrefill', () => {
  it('given one proposal with a feasibility and an equity review, when the prefill is built, then it fills title, location, description and the summed budget, with candidates that name their sources', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, createSubmittedProposal, createReview } =
      await seedDevelopDecision(testData);
    const proposal = await createSubmittedProposal({ title: 'Bike lanes' });
    const feasibility = await createReview({
      proposalId: proposal.id,
      phaseId: FEASIBILITY,
      reviewData: costs({
        design: 1000,
        construction: 20000,
        contingency: 500,
      }),
    });
    const equity = await createReview({
      proposalId: proposal.id,
      phaseId: EQUITY,
      reviewData: equityScores,
    });

    const result = await getDevelopPrefill({
      instanceId,
      inputs: [
        { type: 'proposal', phaseId: SUBMISSION, id: proposal.id },
        { type: 'review', phaseId: FEASIBILITY, id: feasibility.id },
        { type: 'review', phaseId: EQUITY, id: equity.id },
      ],
      target: { type: 'proposal', phaseId: BALLOT },
      rules,
      user: setup.user,
    });

    expect(result).toEqual({
      ok: true,
      data: {
        title: 'Bike lanes',
        location: { lat: 39.96, lng: -83 },
        description: 'Summary of Bike lanes',
        budget: { amount: 21500 },
      },
      candidates: {
        '/title': [{ value: 'Bike lanes', sourceId: proposal.id }],
        '/location': [
          { value: { lat: 39.96, lng: -83 }, sourceId: proposal.id },
        ],
        '/description': [
          { value: 'Summary of Bike lanes', sourceId: proposal.id },
        ],
        '/budget/amount': [{ value: 21500, sourceId: feasibility.id }],
      },
    });
  });

  it('given two feasibility reviews with different costs, when the prefill is built, then the budget stays empty and keeps both candidates', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, createSubmittedProposal, createReview } =
      await seedDevelopDecision(testData);
    const proposal = await createSubmittedProposal({ title: 'Library roof' });
    const first = await createReview({
      proposalId: proposal.id,
      phaseId: FEASIBILITY,
      reviewData: costs({ design: 100, construction: 200, contingency: 300 }),
    });
    const second = await createReview({
      proposalId: proposal.id,
      phaseId: FEASIBILITY,
      reviewData: costs({ design: 100, construction: 900, contingency: 300 }),
      reviewer: 1,
    });

    const result = await getDevelopPrefill({
      instanceId,
      inputs: [
        { type: 'proposal', phaseId: SUBMISSION, id: proposal.id },
        { type: 'review', phaseId: FEASIBILITY, id: first.id },
        { type: 'review', phaseId: FEASIBILITY, id: second.id },
      ],
      target: { type: 'proposal', phaseId: BALLOT },
      rules,
      user: setup.user,
    });

    if (!result.ok) {
      throw new Error(`Expected a prefill, got ${JSON.stringify(result)}`);
    }
    expect(result.data).not.toHaveProperty('budget');
    expect(result.data.title).toBe('Library roof');
    expect(result.candidates['/budget/amount']).toEqual([
      { value: 600, sourceId: first.id },
      { value: 1300, sourceId: second.id },
    ]);
  });

  it('given three proposals with their reviews, when the prefill is built, then the title keeps three candidates and is not filled', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, createSubmittedProposal, createReview } =
      await seedDevelopDecision(testData);
    const titles = ['Park benches', 'Park lights', 'Park paths'];
    const proposals = [];
    for (const title of titles) {
      proposals.push(await createSubmittedProposal({ title }));
    }
    const reviews = [];
    for (const proposal of proposals) {
      reviews.push(
        await createReview({
          proposalId: proposal.id,
          phaseId: FEASIBILITY,
          reviewData: costs({ design: 1, construction: 2, contingency: 3 }),
        }),
        await createReview({
          proposalId: proposal.id,
          phaseId: EQUITY,
          reviewData: equityScores,
        }),
      );
    }

    const result = await getDevelopPrefill({
      instanceId,
      inputs: [
        ...proposals.map((proposal) => ({
          type: 'proposal' as const,
          phaseId: SUBMISSION,
          id: proposal.id,
        })),
        ...reviews.map((review, index) => ({
          type: 'review' as const,
          phaseId: index % 2 === 0 ? FEASIBILITY : EQUITY,
          id: review.id,
        })),
      ],
      target: { type: 'proposal', phaseId: BALLOT },
      rules,
      user: setup.user,
    });

    if (!result.ok) {
      throw new Error(`Expected a prefill, got ${JSON.stringify(result)}`);
    }
    expect(result.data).not.toHaveProperty('title');
    expect(result.candidates['/title']).toEqual(
      proposals.map((proposal, index) => ({
        value: titles[index],
        sourceId: proposal.id,
      })),
    );
    expect(result.data.budget).toEqual({ amount: 6 });
  });

  it('given a rule that reads a field the source rubric does not have, when the prefill is built, then it returns the problem with the rule index', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, createSubmittedProposal } =
      await seedDevelopDecision(testData);
    const proposal = await createSubmittedProposal({ title: 'Crosswalks' });

    const result = await getDevelopPrefill({
      instanceId,
      inputs: [{ type: 'proposal', phaseId: SUBMISSION, id: proposal.id }],
      target: { type: 'proposal', phaseId: BALLOT },
      rules: [
        ...rules,
        {
          sourceSchema: feasibilityRef,
          targetSchema: ballotRef,
          targetPointer: '/budget/amount',
          value: { pointer: '/cost_total/amount' },
        },
      ],
      user: setup.user,
    });

    expect(result).toEqual({
      ok: false,
      problems: [
        {
          code: 'sourcePointerNotFound',
          ruleIndex: 4,
          pointer: '/cost_total/amount',
        },
      ],
    });
  });

  it('given callers with and without the Develop Proposals permission, when each builds the prefill, then only the one without it is refused', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, instanceProfileId, createSubmittedProposal } =
      await seedDevelopDecision(testData);
    const proposal = await createSubmittedProposal({ title: 'Bus shelters' });
    const [developer, reviewer] = await Promise.all([
      testData.createMemberUser({ organization: setup.organization }),
      testData.createMemberUser({ organization: setup.organization }),
    ]);
    await Promise.all([
      grantInstanceRole({
        instanceProfileId,
        authUserId: developer.authUserId,
        email: developer.email,
        roleName: `Developer-${task.id}`,
        decisionsPermission:
          TEST_PERMISSION_BITS.READ | TEST_PERMISSION_BITS.DEVELOP_PROPOSALS,
      }),
      grantInstanceRole({
        instanceProfileId,
        authUserId: reviewer.authUserId,
        email: reviewer.email,
        roleName: `Reviewer-${task.id}`,
        decisionsPermission:
          TEST_PERMISSION_BITS.READ | TEST_PERMISSION_BITS.REVIEW,
      }),
    ]);

    const buildPrefill = (user: typeof setup.user) =>
      getDevelopPrefill({
        instanceId,
        inputs: [{ type: 'proposal', phaseId: SUBMISSION, id: proposal.id }],
        target: { type: 'proposal', phaseId: BALLOT },
        rules,
        user,
      });

    await expect(buildPrefill(reviewer.user)).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    await expect(buildPrefill(developer.user)).resolves.toMatchObject({
      ok: true,
      data: { title: 'Bus shelters' },
    });
    await expect(buildPrefill(setup.user)).resolves.toMatchObject({
      ok: true,
      data: { title: 'Bus shelters' },
    });
  });

  it('given inputs that do not fit together, when the prefill is built, then each is refused with its own error', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const {
      setup,
      instanceId,
      otherInstanceId,
      createSubmittedProposal,
      createReview,
    } = await seedDevelopDecision(testData);
    const [proposal, unlisted, foreign] = await Promise.all([
      createSubmittedProposal({ title: 'Sidewalks' }),
      createSubmittedProposal({ title: 'Not an input' }),
      createSubmittedProposal({
        title: 'Other decision',
        processInstanceId: otherInstanceId,
      }),
    ]);
    const [equityReview, draftReview, unlistedReview] = await Promise.all([
      createReview({
        proposalId: proposal.id,
        phaseId: EQUITY,
        reviewData: equityScores,
      }),
      createReview({
        proposalId: proposal.id,
        phaseId: FEASIBILITY,
        reviewData: costs({ design: 1, construction: 1, contingency: 1 }),
        state: ProposalReviewState.DRAFT,
      }),
      createReview({
        proposalId: unlisted.id,
        phaseId: FEASIBILITY,
        reviewData: costs({ design: 1, construction: 1, contingency: 1 }),
      }),
    ]);

    const buildPrefill = (
      inputs: Parameters<typeof getDevelopPrefill>[0]['inputs'],
    ) =>
      getDevelopPrefill({
        instanceId,
        inputs: [
          { type: 'proposal', phaseId: SUBMISSION, id: proposal.id },
          ...inputs,
        ],
        target: { type: 'proposal', phaseId: BALLOT },
        rules,
        user: setup.user,
      });

    await expectRejection({
      promise: buildPrefill([
        { type: 'review', phaseId: FEASIBILITY, id: equityReview.id },
      ]),
      errorClass: ValidationError,
      message: `Review '${equityReview.id}' belongs to phase '${EQUITY}', not '${FEASIBILITY}'`,
    });
    await expectRejection({
      promise: buildPrefill([
        { type: 'review', phaseId: FEASIBILITY, id: draftReview.id },
      ]),
      errorClass: ValidationError,
      message: `Review '${draftReview.id}' is not submitted and cannot be developed`,
    });
    await expectRejection({
      promise: buildPrefill([
        { type: 'review', phaseId: FEASIBILITY, id: unlistedReview.id },
      ]),
      errorClass: ValidationError,
      message: `Review '${unlistedReview.id}' is of a proposal that is not among the inputs`,
    });
    await expectRejection({
      promise: buildPrefill([
        { type: 'proposal', phaseId: SUBMISSION, id: foreign.id },
      ]),
      errorClass: NotFoundError,
      message: new NotFoundError('Proposal', foreign.id).message,
    });
  });
});
