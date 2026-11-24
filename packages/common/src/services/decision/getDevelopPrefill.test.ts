import { mockCollab, textFragment } from '@op/collab/testing';
import {
  TEST_PERMISSION_BITS,
  TestDecisionsDataManager,
  createProposalReview,
  createReviewAssignment,
  grantInstanceRole,
  syncPhaseRows,
} from '@op/common/testing';
import { db } from '@op/db/client';
import {
  ProposalReviewState,
  ProposalStatus,
  Visibility,
  formSchemas,
  processInstances,
  proposals as proposalsTable,
} from '@op/db/schema';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { DEFAULT_MONEY_CURRENCY } from '../../money';
import type { SchemaMapping } from '../../schemaMapping';
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
    {
      id: BALLOT,
      name: 'Ballot development',
      rules: {
        ...closedPhaseRules,
        proposals: { submit: false, develop: true },
      },
    },
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

const entryForm = {
  type: 'object',
  'x-field-order': ['title', 'ballotDescription'],
  properties: {
    title: { type: 'string', 'x-format': 'short-text' },
    ballotDescription: { type: 'string', 'x-format': 'long-text' },
  },
};

const submissionRef = { type: 'proposal', phaseId: SUBMISSION } as const;
const feasibilityRef = { type: 'review', phaseId: FEASIBILITY } as const;
const ballotRef = { type: 'proposal', phaseId: BALLOT } as const;

const mappings: SchemaMapping[] = [
  {
    from: submissionRef,
    to: ballotRef,
    fields: [
      { from: 'title', to: 'title' },
      { from: 'location', to: 'location' },
      { from: 'summary', to: 'description' },
    ],
  },
  {
    from: feasibilityRef,
    to: ballotRef,
    fields: [{ from: 'cost_construction', to: 'budget' }],
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

const insertFormSchema = async (values: {
  processInstanceId: string;
  schema: Record<string, unknown>;
}) => {
  const [row] = await db
    .insert(formSchemas)
    .values({ ...values, name: 'Entry form' })
    .returning();
  if (!row) {
    throw new Error('Expected the form schema insert to return a row');
  }
  return row;
};

/** `ballotFormSchema: null` gives the develop phase no `formSchemaId` row. */
const seedDevelopDecision = async (
  testData: TestDecisionsDataManager,
  {
    ballotFormSchema = ballotForm,
  }: { ballotFormSchema?: Record<string, unknown> | null } = {},
) => {
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

  const ballotFormRow = ballotFormSchema
    ? await insertFormSchema({
        processInstanceId: instance.instance.id,
        schema: ballotFormSchema,
      })
    : undefined;

  const phaseTemplates: Record<string, object> = {
    [FEASIBILITY]: { rubricTemplate: feasibilityRubric },
    [EQUITY]: { rubricTemplate: equityRubric },
    [BALLOT]: {
      proposalTemplate: ballotForm,
      ...(ballotFormRow ? { formSchemaId: ballotFormRow.id } : {}),
    },
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
  await syncPhaseRows(instance.instance.id);

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
    processInstanceId = instance.instance.id,
  }: {
    proposalId: string;
    phaseId: string;
    reviewData: Record<string, unknown>;
    reviewer?: 0 | 1;
    state?: ProposalReviewState;
    processInstanceId?: string;
  }) => {
    const assignment = await createReviewAssignment({
      processInstanceId,
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
  it('given one proposal with a feasibility and an equity review, when the prefill is built, then it fills title, location, description and budget', async ({
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
        { type: 'review', id: feasibility.id },
        { type: 'review', id: equity.id },
      ],
      target: { type: 'proposal', phaseId: BALLOT },
      mappings,
      user: setup.user,
    });

    expect(result).toEqual({
      data: {
        title: 'Bike lanes',
        location: { lat: 39.96, lng: -83 },
        description: 'Summary of Bike lanes',
        budget: { amount: 20000, currency: 'USD' },
      },
    });
  });

  it('given two feasibility reviews with different costs, when the prefill is built, then the budget stays empty', async ({
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
        { type: 'review', id: first.id },
        { type: 'review', id: second.id },
      ],
      target: { type: 'proposal', phaseId: BALLOT },
      mappings,
      user: setup.user,
    });

    expect(result.data).not.toHaveProperty('budget');
    expect(result.data.title).toBe('Library roof');
  });

  it('given three proposals with their reviews, when the prefill is built, then the title is not filled', async ({
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
        ...reviews.map((review) => ({
          type: 'review' as const,
          id: review.id,
        })),
      ],
      target: { type: 'proposal', phaseId: BALLOT },
      mappings,
      user: setup.user,
    });

    expect(result.data).not.toHaveProperty('title');
    expect(result.data.budget).toEqual({ amount: 2, currency: 'USD' });
  });

  it('given a feasibility and an equity review, when each is developed, then it is mapped under its own assignment phase', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, createSubmittedProposal, createReview } =
      await seedDevelopDecision(testData);
    const proposal = await createSubmittedProposal({ title: 'Skate park' });
    const [feasibility, equity] = await Promise.all([
      createReview({
        proposalId: proposal.id,
        phaseId: FEASIBILITY,
        reviewData: costs({ design: 1, construction: 700, contingency: 1 }),
      }),
      createReview({
        proposalId: proposal.id,
        phaseId: EQUITY,
        reviewData: equityScores,
      }),
    ]);

    const buildPrefill = (reviewId: string) =>
      getDevelopPrefill({
        instanceId,
        inputs: [
          { type: 'proposal', phaseId: SUBMISSION, id: proposal.id },
          { type: 'review', id: reviewId },
        ],
        target: { type: 'proposal', phaseId: BALLOT },
        mappings,
        user: setup.user,
      });

    // Only the feasibility mapping fills the budget.
    const fromFeasibility = await buildPrefill(feasibility.id);
    expect(fromFeasibility.data.budget).toEqual({
      amount: 700,
      currency: 'USD',
    });
    const fromEquity = await buildPrefill(equity.id);
    expect(fromEquity.data).not.toHaveProperty('budget');
  });

  it('given a developer, a profile admin, a decisions admin and a reviewer, when each builds the prefill, then only the reviewer is refused', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, instanceProfileId, createSubmittedProposal } =
      await seedDevelopDecision(testData);
    const proposal = await createSubmittedProposal({ title: 'Bus shelters' });
    const [developer, reviewer, profileAdmin, decisionsAdmin] =
      await Promise.all([
        testData.createMemberUser({ organization: setup.organization }),
        testData.createMemberUser({ organization: setup.organization }),
        testData.createMemberUser({ organization: setup.organization }),
        testData.createMemberUser({ organization: setup.organization }),
      ]);
    await Promise.all([
      grantInstanceRole({
        instanceProfileId,
        authUserId: profileAdmin.authUserId,
        email: profileAdmin.email,
        roleName: `Profile admin-${task.id}`,
        decisionsPermission: TEST_PERMISSION_BITS.READ,
        profilePermission: TEST_PERMISSION_BITS.ADMIN,
      }),
      grantInstanceRole({
        instanceProfileId,
        authUserId: decisionsAdmin.authUserId,
        email: decisionsAdmin.email,
        roleName: `Decisions admin-${task.id}`,
        decisionsPermission:
          TEST_PERMISSION_BITS.READ | TEST_PERMISSION_BITS.ADMIN,
      }),
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
        mappings,
        user,
      });

    await expect(buildPrefill(reviewer.user)).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    for (const user of [
      developer.user,
      profileAdmin.user,
      decisionsAdmin.user,
      setup.user,
    ]) {
      await expect(buildPrefill(user)).resolves.toMatchObject({
        data: { title: 'Bus shelters' },
      });
    }
  });

  it('given a phase that does not develop, when the prefill targets it, then it is refused', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, createSubmittedProposal } =
      await seedDevelopDecision(testData);
    const proposal = await createSubmittedProposal({ title: 'Murals' });

    await expectRejection({
      promise: getDevelopPrefill({
        instanceId,
        inputs: [{ type: 'proposal', phaseId: SUBMISSION, id: proposal.id }],
        target: { type: 'proposal', phaseId: SUBMISSION },
        mappings: [
          {
            from: submissionRef,
            to: submissionRef,
            fields: [{ from: 'title', to: 'title' }],
          },
        ],
        user: setup.user,
      }),
      errorClass: ValidationError,
      message: 'Proposals cannot be developed in the Submission phase',
    });
  });

  it('given a develop phase with a form schema row, when the prefill is built, then it maps into that form and not the phase or instance template', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, createSubmittedProposal } =
      await seedDevelopDecision(testData, { ballotFormSchema: entryForm });
    const proposal = await createSubmittedProposal({ title: 'Tree canopy' });

    const buildPrefill = (fields: SchemaMapping['fields']) =>
      getDevelopPrefill({
        instanceId,
        inputs: [{ type: 'proposal', phaseId: SUBMISSION, id: proposal.id }],
        target: { type: 'proposal', phaseId: BALLOT },
        mappings: [{ from: submissionRef, to: ballotRef, fields }],
        user: setup.user,
      });

    await expect(
      buildPrefill([
        { from: 'title', to: 'title' },
        { from: 'summary', to: 'ballotDescription' },
      ]),
    ).resolves.toEqual({
      data: {
        title: 'Tree canopy',
        ballotDescription: 'Summary of Tree canopy',
      },
    });
    // `description` is a field of the phase template and `summary` of the
    // instance template; neither is a field of the row.
    for (const to of ['description', 'summary']) {
      await expectRejection({
        promise: buildPrefill([{ from: 'summary', to }]),
        errorClass: ValidationError,
        message: `Target field '${to}' is not a field of the proposal form of phase '${BALLOT}'`,
      });
    }
  });

  it('given a develop phase without a form schema row, when the prefill is built, then it maps into the instance template and not the phase template', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, createSubmittedProposal } =
      await seedDevelopDecision(testData, { ballotFormSchema: null });
    const proposal = await createSubmittedProposal({ title: 'Bike racks' });

    const buildPrefill = (fields: SchemaMapping['fields']) =>
      getDevelopPrefill({
        instanceId,
        inputs: [{ type: 'proposal', phaseId: SUBMISSION, id: proposal.id }],
        target: { type: 'proposal', phaseId: BALLOT },
        mappings: [{ from: submissionRef, to: ballotRef, fields }],
        user: setup.user,
      });

    await expect(
      buildPrefill([
        { from: 'title', to: 'title' },
        { from: 'summary', to: 'summary' },
      ]),
    ).resolves.toEqual({
      data: { title: 'Bike racks', summary: 'Summary of Bike racks' },
    });
    // `description` is a field of the phase template only.
    await expectRejection({
      promise: buildPrefill([{ from: 'summary', to: 'description' }]),
      errorClass: ValidationError,
      message: `Target field 'description' is not a field of the proposal form of phase '${BALLOT}'`,
    });
  });

  it('given a mapping into a field the target form does not have, when the prefill is built, then it is refused naming the field', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, createSubmittedProposal } =
      await seedDevelopDecision(testData);
    const proposal = await createSubmittedProposal({ title: 'Crosswalks' });

    await expectRejection({
      promise: getDevelopPrefill({
        instanceId,
        inputs: [{ type: 'proposal', phaseId: SUBMISSION, id: proposal.id }],
        target: { type: 'proposal', phaseId: BALLOT },
        mappings: [
          {
            from: submissionRef,
            to: ballotRef,
            fields: [
              { from: 'title', to: 'title' },
              { from: 'summary', to: 'nickname' },
            ],
          },
        ],
        user: setup.user,
      }),
      errorClass: ValidationError,
      message: `Target field 'nickname' is not a field of the proposal form of phase '${BALLOT}'`,
    });
  });

  it('given a proposal whose document cannot be fetched, when the prefill is built, then that proposal gives no data and the others still fill the target', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, createSubmittedProposal } =
      await seedDevelopDecision(testData);
    const [available, unavailable] = await Promise.all([
      createSubmittedProposal({ title: 'Splash pad' }),
      // No fragments are seeded, so the document fetch fails.
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instanceId,
        proposalData: { title: 'Unreachable' },
        status: ProposalStatus.SUBMITTED,
      }),
    ]);

    const result = await getDevelopPrefill({
      instanceId,
      inputs: [
        { type: 'proposal', phaseId: SUBMISSION, id: available.id },
        { type: 'proposal', phaseId: SUBMISSION, id: unavailable.id },
      ],
      target: { type: 'proposal', phaseId: BALLOT },
      mappings,
      user: setup.user,
    });

    expect(result.data).toMatchObject({
      title: 'Splash pad',
      description: 'Summary of Splash pad',
    });
  });

  it('given a hidden proposal, when a caller with only Develop Proposals builds the prefill from it, then it is refused as not found while the instance admin still gets the data', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, instanceProfileId, createSubmittedProposal } =
      await seedDevelopDecision(testData);
    const [proposal, developer] = await Promise.all([
      createSubmittedProposal({ title: 'Hidden plaza' }),
      testData.createMemberUser({ organization: setup.organization }),
    ]);
    await Promise.all([
      db
        .update(proposalsTable)
        .set({ visibility: Visibility.HIDDEN })
        .where(eq(proposalsTable.id, proposal.id)),
      grantInstanceRole({
        instanceProfileId,
        authUserId: developer.authUserId,
        email: developer.email,
        roleName: `Developer-${task.id}`,
        decisionsPermission:
          TEST_PERMISSION_BITS.READ | TEST_PERMISSION_BITS.DEVELOP_PROPOSALS,
      }),
    ]);

    const buildPrefill = (user: typeof setup.user) =>
      getDevelopPrefill({
        instanceId,
        inputs: [{ type: 'proposal', phaseId: SUBMISSION, id: proposal.id }],
        target: { type: 'proposal', phaseId: BALLOT },
        mappings,
        user,
      });

    await expectRejection({
      promise: buildPrefill(developer.user),
      errorClass: NotFoundError,
      message: new NotFoundError('Proposal', proposal.id).message,
    });
    await expect(buildPrefill(setup.user)).resolves.toMatchObject({
      data: { title: 'Hidden plaza' },
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
    const [draftReview, unlistedReview, foreignReview] = await Promise.all([
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
      createReview({
        proposalId: foreign.id,
        phaseId: FEASIBILITY,
        reviewData: costs({ design: 1, construction: 1, contingency: 1 }),
        processInstanceId: otherInstanceId,
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
        mappings,
        user: setup.user,
      });

    await expectRejection({
      promise: buildPrefill([
        { type: 'review', id: draftReview.id },
        { type: 'review', id: foreignReview.id },
      ]),
      errorClass: ValidationError,
      message: `These reviews cannot be developed: ${draftReview.id}, ${foreignReview.id}`,
    });
    await expectRejection({
      promise: buildPrefill([{ type: 'review', id: unlistedReview.id }]),
      errorClass: ValidationError,
      message: `Review '${unlistedReview.id}' is of a proposal that is not among the inputs`,
    });
    await expectRejection({
      promise: buildPrefill([
        { type: 'proposal', phaseId: SUBMISSION, id: foreign.id },
      ]),
      errorClass: ValidationError,
      message: `These proposals cannot be developed: ${foreign.id}`,
    });
    await expectRejection({
      promise: getDevelopPrefill({
        instanceId,
        inputs: [{ type: 'proposal', phaseId: FEASIBILITY, id: proposal.id }],
        target: { type: 'proposal', phaseId: BALLOT },
        mappings,
        user: setup.user,
      }),
      errorClass: ValidationError,
      message: `Proposal '${proposal.id}' is not in phase '${FEASIBILITY}'`,
    });
  });

  describe('with the sum of review costs', () => {
    const costTotalMappings: SchemaMapping[] = [
      {
        from: submissionRef,
        to: ballotRef,
        fields: [{ from: 'title', to: 'title' }],
      },
      {
        from: feasibilityRef,
        to: ballotRef,
        fields: [
          {
            from: {
              operator: 'add',
              operands: [
                { field: 'answers.cost_design.amount' },
                { field: 'answers.cost_construction.amount' },
                { field: 'answers.cost_contingency.amount' },
              ],
            },
            to: 'budget',
          },
        ],
      },
    ];

    const answers = (values: Parameters<typeof costs>[0]) => ({
      answers: costs(values),
    });

    it('given one proposal whose two feasibility reviews give the same total, when the prefill is built, then the budget is that total', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const { setup, instanceId, createSubmittedProposal, createReview } =
        await seedDevelopDecision(testData);
      const garden = await createSubmittedProposal({ title: 'Garden' });
      const reviews = await Promise.all([
        createReview({
          proposalId: garden.id,
          phaseId: FEASIBILITY,
          reviewData: answers({ design: 10, construction: 20, contingency: 5 }),
        }),
        createReview({
          proposalId: garden.id,
          phaseId: FEASIBILITY,
          reviewData: answers({ design: 0, construction: 30, contingency: 5 }),
          reviewer: 1,
        }),
        // An equity review is of another source schema and is not summed.
        createReview({
          proposalId: garden.id,
          phaseId: EQUITY,
          reviewData: { answers: equityScores },
        }),
      ]);

      const result = await getDevelopPrefill({
        instanceId,
        inputs: [
          { type: 'proposal', phaseId: SUBMISSION, id: garden.id },
          ...reviews.map((review) => ({
            type: 'review' as const,
            id: review.id,
          })),
        ],
        target: { type: 'proposal', phaseId: BALLOT },
        mappings: costTotalMappings,
        user: setup.user,
      });

      expect(result).toStrictEqual({
        data: {
          title: 'Garden',
          budget: { amount: 35, currency: DEFAULT_MONEY_CURRENCY },
        },
      });
    });

    it('given two proposals whose reviews give the same total, when the prefill is built, then the budget stays empty and the copy rules still apply', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const { setup, instanceId, createSubmittedProposal, createReview } =
        await seedDevelopDecision(testData);
      const garden = await createSubmittedProposal({ title: 'Garden' });
      const benches = await createSubmittedProposal({ title: 'Garden' });
      const reviews = await Promise.all(
        [garden, benches].map((proposal) =>
          createReview({
            proposalId: proposal.id,
            phaseId: FEASIBILITY,
            reviewData: answers({
              design: 1000,
              construction: 3000,
              contingency: 1000,
            }),
          }),
        ),
      );

      const result = await getDevelopPrefill({
        instanceId,
        inputs: [
          { type: 'proposal', phaseId: SUBMISSION, id: garden.id },
          { type: 'proposal', phaseId: SUBMISSION, id: benches.id },
          ...reviews.map((review) => ({
            type: 'review' as const,
            id: review.id,
          })),
        ],
        target: { type: 'proposal', phaseId: BALLOT },
        mappings: costTotalMappings,
        user: setup.user,
      });

      expect(result).toEqual({ data: { title: 'Garden' } });
    });
  });
});
