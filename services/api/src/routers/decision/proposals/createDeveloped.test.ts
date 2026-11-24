import {
  createTipTapClient,
  mockCollab,
  textFragment,
} from '@op/collab/testing';
import {
  DEFAULT_MONEY_CURRENCY,
  type PhaseInstanceData,
  type ProposalTemplateSchema,
  assembleProposalData,
  getInstancePhases,
} from '@op/common';
import {
  TEST_PERMISSION_BITS,
  TestDecisionsDataManager,
  createCategoryReviewerWithTerm,
  createDevelopPhaseSetup,
  createDevelopProposalsMember,
  createProposalReview,
  createReviewAssignment,
  grantInstanceRole,
  openDevelopWindow,
  testDevelopSchema,
  syncPhaseRows,
} from '@op/common/testing';
import {
  ProcessStatus,
  ProposalRelationshipType,
  ProposalReviewState,
  ProposalStatus,
  processInstances,
  proposals,
} from '@op/db/schema';
import { ROLES } from '@op/db/seedData/accessControl';
import { db, eq } from '@op/db/test';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import {
  attachFormSchema,
  insertFormSchema,
  seedCollabFragments,
} from '../../../test/helpers/formSchemaTestUtils';
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

const readDevelopedSourceIds = async (targetProposalId: string) => {
  const edges = await db.query.proposalRelationships.findMany({
    where: {
      targetProposalId,
      relationshipType: ProposalRelationshipType.DEVELOPED,
    },
    columns: { sourceProposalId: true },
  });
  return edges.map((edge) => edge.sourceProposalId);
};

/** Writes setup-script fields on the develop phase ("final"). */
const configureDevelopPhase = async (
  instanceId: string,
  fields: Partial<PhaseInstanceData>,
) => {
  const instance = await db.query.processInstances.findFirst({
    where: { id: instanceId },
    columns: { instanceData: true },
  });
  const instanceData = instance?.instanceData;
  if (!instanceData) {
    throw new Error(`Instance ${instanceId} has no instanceData`);
  }
  const phases = getInstancePhases(instanceData).map((phase) =>
    phase.phaseId === 'final' ? { ...phase, ...fields } : phase,
  );
  await db
    .update(processInstances)
    .set({ instanceData: { ...instanceData, phases } })
    .where(eq(processInstances.id, instanceId));
  await syncPhaseRows(instanceId, phases);
};

const sourceFormSchema = {
  type: 'object',
  'x-field-order': ['title', 'summary', 'category', 'budget'],
  properties: {
    title: { type: 'string', title: 'Title', 'x-format': 'short-text' },
    summary: { type: 'string', title: 'Summary', 'x-format': 'long-text' },
    category: {
      type: 'string',
      title: 'Category',
      'x-format': 'dropdown',
      oneOf: [{ const: 'Parks', title: 'Parks' }],
    },
    budget: { type: 'object', title: 'Budget', 'x-format': 'money' },
  },
};

/** The entry form: a title cap the source title is over, and a budget. */
const prefillEntrySchema = {
  type: 'object',
  'x-field-order': ['title', 'description', 'category', 'budget'],
  properties: {
    title: {
      type: 'string',
      title: 'Title',
      maxLength: 20,
      'x-format': 'short-text',
    },
    description: {
      type: 'string',
      title: 'Description',
      'x-format': 'long-text',
    },
    category: {
      type: 'string',
      title: 'Category',
      'x-format': 'dropdown',
      oneOf: [{ const: 'Parks', title: 'Parks' }],
    },
    budget: { type: 'object', title: 'Budget', 'x-format': 'money' },
  },
};

const budgetTemplate: ProposalTemplateSchema = {
  type: 'object',
  properties: { budget: { type: 'object', 'x-format': 'money' } },
};

const SOURCE_TITLE = 'Riverside community garden expansion';
const SOURCE_BUDGET = '{"amount":500,"currency":"USD"}';

const sourceToEntry = (
  fields: Array<{ from: string; to: string }>,
): PhaseInstanceData['developPrefillMappings'] => [
  {
    from: { type: 'proposal', phaseId: 'initial' },
    to: { type: 'proposal', phaseId: 'final' },
    fields,
  },
];

/** Maps title, summary, category and budget from the source to the entry form. */
const configurePrefill = async ({
  instanceId,
  sourceId,
  summary,
}: {
  instanceId: string;
  sourceId: string;
  summary: string;
}) => {
  const [sourceRow, entryRow] = await Promise.all([
    insertFormSchema({
      processInstanceId: instanceId,
      name: 'Source',
      schema: sourceFormSchema,
    }),
    insertFormSchema({
      processInstanceId: instanceId,
      name: 'Ballot entry',
      schema: prefillEntrySchema,
    }),
  ]);
  await attachFormSchema(sourceId, sourceRow.id);
  await seedCollabFragments(sourceId, {
    title: SOURCE_TITLE,
    summary,
    category: 'Parks',
    budget: SOURCE_BUDGET,
  });
  await configureDevelopPhase(instanceId, {
    formSchemaId: entryRow.id,
    developPrefillMappings: sourceToEntry([
      { from: 'title', to: 'title' },
      { from: 'summary', to: 'description' },
      { from: 'category', to: 'category' },
      { from: 'budget', to: 'budget' },
    ]),
  });
  return { entryFormSchemaId: entryRow.id };
};

const usd = (amount: number) => ({ amount, currency: 'USD' });

const configureCostTotal = async (instanceId: string) => {
  const entryRow = await insertFormSchema({
    processInstanceId: instanceId,
    name: 'Ballot entry',
    schema: prefillEntrySchema,
  });
  await configureDevelopPhase(instanceId, {
    formSchemaId: entryRow.id,
    developPrefillMappings: [
      {
        from: { type: 'review', phaseId: 'initial' },
        to: { type: 'proposal', phaseId: 'final' },
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
    ],
  });
};

const createCostReview = async ({
  instanceId,
  proposalId,
  reviewerProfileId,
  answers,
  state = ProposalReviewState.SUBMITTED,
  phaseId = 'initial',
}: {
  instanceId: string;
  proposalId: string;
  reviewerProfileId: string;
  answers: Record<string, unknown>;
  state?: ProposalReviewState;
  phaseId?: string;
}) => {
  const assignment = await createReviewAssignment({
    processInstanceId: instanceId,
    proposalId,
    reviewerProfileId,
    phaseId,
  });
  return createProposalReview({
    assignmentId: assignment.id,
    state,
    reviewData: { answers },
  });
};

const EMPTY_FRAGMENT = { type: 'doc', content: [] };

const readEntryDocument = (proposalId: string) =>
  createTipTapClient().getDocumentFragments(`proposal-${proposalId}`, [
    'title',
    'description',
    'category',
    'budget',
  ]);

const readFormSchemaId = async (proposalId: string) => {
  const row = await db.query.proposals.findFirst({
    where: { id: proposalId },
    columns: { formSchemaId: true },
  });
  return row?.formSchemaId;
};

const readProposalData = async (proposalId: string) => {
  const row = await db.query.proposals.findFirst({
    where: { id: proposalId },
    columns: { proposalData: true },
  });
  return row?.proposalData;
};

const NOT_AUTHORIZED = {
  cause: { name: 'UnauthorizedError', message: 'Not authorized' },
};

describe.concurrent('createDevelopedProposal', () => {
  it('lets a caller with Develop Proposals and no Review or Submit bit create a draft and writes one developed edge per source', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, source } = await createDevelopPhaseSetup({
      testData,
    });
    const developer = await createDevelopProposalsMember({
      testData,
      setup,
    });
    const caller = await createAuthenticatedCaller(developer.email);

    const draft = await caller.decision.createDevelopedProposal({
      processInstanceId: instanceId,
      sourceProposalIds: [source.id],
      proposalData: { title: 'Developed' },
    });
    testData.trackProfileForCleanup(draft.profileId);

    expect(draft.status).toBe(ProposalStatus.DRAFT);
    expect(draft.profile.name).toBe('Developed');
    await expect(readDevelopedSourceIds(draft.id)).resolves.toEqual([
      source.id,
    ]);
  });

  it('lets a profile admin create a draft', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, source } = await createDevelopPhaseSetup({
      testData,
    });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const draft = await caller.decision.createDevelopedProposal({
      processInstanceId: instanceId,
      sourceProposalIds: [source.id],
      proposalData: { title: 'Admin developed' },
    });
    testData.trackProfileForCleanup(draft.profileId);

    await expect(readDevelopedSourceIds(draft.id)).resolves.toEqual([
      source.id,
    ]);
  });

  it('lets a caller with the decisions Admin permission and no Develop Proposals bit create a draft', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, source } = await createDevelopPhaseSetup({
      testData,
    });
    const decisionsAdmin = await testData.createMemberUser({
      organization: setup.organization,
    });
    await grantInstanceRole({
      instanceProfileId: setup.instance.profileId,
      authUserId: decisionsAdmin.authUserId,
      email: decisionsAdmin.email,
      roleName: `Decisions Admin ${decisionsAdmin.authUserId}`,
      decisionsPermission:
        TEST_PERMISSION_BITS.READ | TEST_PERMISSION_BITS.ADMIN,
    });
    const caller = await createAuthenticatedCaller(decisionsAdmin.email);

    const draft = await caller.decision.createDevelopedProposal({
      processInstanceId: instanceId,
      sourceProposalIds: [source.id],
      proposalData: { title: 'Developed' },
    });
    testData.trackProfileForCleanup(draft.profileId);

    await expect(readDevelopedSourceIds(draft.id)).resolves.toEqual([
      source.id,
    ]);
  });

  it('refuses a caller with Review, Submit and a category-reviewer row for the phase but without Develop Proposals', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, source } = await createDevelopPhaseSetup({
      testData,
    });
    const reviewer = await testData.createMemberUser({
      organization: setup.organization,
    });
    await grantInstanceRole({
      instanceProfileId: setup.instance.profileId,
      authUserId: reviewer.authUserId,
      email: reviewer.email,
      roleName: `Reviewer ${reviewer.authUserId}`,
      decisionsPermission:
        TEST_PERMISSION_BITS.READ |
        TEST_PERMISSION_BITS.REVIEW |
        TEST_PERMISSION_BITS.SUBMIT_PROPOSALS,
    });
    await createCategoryReviewerWithTerm({
      processInstanceId: instanceId,
      reviewerProfileId: reviewer.profileId,
      phaseId: 'final',
      onTestFinished,
    });
    const caller = await createAuthenticatedCaller(reviewer.email);

    await expect(
      caller.decision.createDevelopedProposal({
        processInstanceId: instanceId,
        sourceProposalIds: [source.id],
        proposalData: { title: 'Refused' },
      }),
    ).rejects.toMatchObject(NOT_AUTHORIZED);
  });

  it('refuses a participant without Develop Proposals', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, source } = await createDevelopPhaseSetup({
      testData,
    });
    const participant = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [setup.instance.profileId],
    });
    const caller = await createAuthenticatedCaller(participant.email);

    await expect(
      caller.decision.createDevelopedProposal({
        processInstanceId: instanceId,
        sourceProposalIds: [source.id],
        proposalData: { title: 'Refused' },
      }),
    ).rejects.toMatchObject(NOT_AUTHORIZED);
  });

  it('refuses an admin of the owning organization with no role on the instance profile', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, source } = await createDevelopPhaseSetup({
      testData,
    });
    const orgAdmin = await testData.createMemberUser({
      organization: setup.organization,
      orgRoleId: ROLES.ADMIN.id,
    });
    const caller = await createAuthenticatedCaller(orgAdmin.email);

    await expect(
      caller.decision.createDevelopedProposal({
        processInstanceId: instanceId,
        sourceProposalIds: [source.id],
        proposalData: { title: 'Refused' },
      }),
    ).rejects.toMatchObject(NOT_AUTHORIZED);
  });

  it('refuses when the current phase is not a develop phase', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      processSchema: testDevelopSchema,
      status: ProcessStatus.PUBLISHED,
    });
    const instanceId = setup.instance.instance.id;
    const source = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instanceId,
      proposalData: { title: 'Source' },
      status: ProposalStatus.SUBMITTED,
    });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.decision.createDevelopedProposal({
        processInstanceId: instanceId,
        sourceProposalIds: [source.id],
        proposalData: { title: 'Refused' },
      }),
    ).rejects.toMatchObject({
      cause: {
        name: 'ValidationError',
        message: expect.stringMatching(
          /^Proposals cannot be developed in the .+ phase$/,
        ),
      },
    });
  });

  it('refuses on an instance without a decision profile', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, source } = await createDevelopPhaseSetup({
      testData,
    });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    await db
      .update(processInstances)
      .set({ profileId: null })
      .where(eq(processInstances.id, instanceId));

    try {
      await expect(
        caller.decision.createDevelopedProposal({
          processInstanceId: instanceId,
          sourceProposalIds: [source.id],
          proposalData: { title: 'Refused' },
        }),
      ).rejects.toMatchObject({
        cause: {
          name: 'UnauthorizedError',
          message: "You don't have access to do this",
        },
      });
    } finally {
      await db
        .update(processInstances)
        .set({ profileId: setup.instance.profileId })
        .where(eq(processInstances.id, instanceId));
    }
  });

  it('refuses a source from another instance', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId } = await createDevelopPhaseSetup({
      testData,
      instanceCount: 2,
    });
    const otherInstance = setup.instances[1];
    if (!otherInstance) {
      throw new Error('Second instance not created');
    }
    const foreign = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: otherInstance.instance.id,
      proposalData: { title: 'Foreign' },
      status: ProposalStatus.SUBMITTED,
    });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.decision.createDevelopedProposal({
        processInstanceId: instanceId,
        sourceProposalIds: [foreign.id],
        proposalData: { title: 'Refused' },
      }),
    ).rejects.toMatchObject({
      cause: {
        name: 'ValidationError',
        message: expect.stringContaining(foreign.id),
      },
    });
  });

  it('refuses a draft source and names it', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      processSchema: testDevelopSchema,
      status: ProcessStatus.PUBLISHED,
    });
    const instanceId = setup.instance.instance.id;
    const [submitted, draft] = await Promise.all([
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instanceId,
        proposalData: { title: 'Submitted' },
        status: ProposalStatus.SUBMITTED,
      }),
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instanceId,
        proposalData: { title: 'Draft' },
      }),
    ]);
    await testData.advancePhase({
      instanceId,
      fromPhaseId: 'initial',
      toPhaseId: 'final',
    });
    await openDevelopWindow({ instanceId });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.decision.createDevelopedProposal({
        processInstanceId: instanceId,
        sourceProposalIds: [submitted.id, draft.id],
        proposalData: { title: 'Refused' },
      }),
    ).rejects.toMatchObject({
      cause: {
        name: 'ValidationError',
        message: `These proposals cannot be developed: ${draft.id}`,
      },
    });
  });

  it('accepts a source from a phase other than the previous one', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId } = await createDevelopPhaseSetup({ testData });
    const lateProposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instanceId,
      proposalData: { title: 'Created in the develop phase' },
      status: ProposalStatus.SUBMITTED,
    });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const draft = await caller.decision.createDevelopedProposal({
      processInstanceId: instanceId,
      sourceProposalIds: [lateProposal.id],
      proposalData: { title: 'Developed' },
    });
    testData.trackProfileForCleanup(draft.profileId);

    await expect(readDevelopedSourceIds(draft.id)).resolves.toEqual([
      lateProposal.id,
    ]);
  });

  it('refuses a rejected source and names it', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, source } = await createDevelopPhaseSetup({
      testData,
    });
    await db
      .update(proposals)
      .set({ status: ProposalStatus.REJECTED })
      .where(eq(proposals.id, source.id));
    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.decision.createDevelopedProposal({
        processInstanceId: instanceId,
        sourceProposalIds: [source.id],
        proposalData: { title: 'Refused' },
      }),
    ).rejects.toMatchObject({
      cause: {
        name: 'ValidationError',
        message: `These proposals cannot be developed: ${source.id}`,
      },
    });
  });

  it('writes one edge per source when a source is listed twice', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, source } = await createDevelopPhaseSetup({
      testData,
    });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const draft = await caller.decision.createDevelopedProposal({
      processInstanceId: instanceId,
      sourceProposalIds: [source.id, source.id],
      proposalData: { title: 'Developed' },
    });
    testData.trackProfileForCleanup(draft.profileId);

    await expect(readDevelopedSourceIds(draft.id)).resolves.toEqual([
      source.id,
    ]);
  });

  it('allows one source to be developed into two drafts', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, source } = await createDevelopPhaseSetup({
      testData,
    });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const first = await caller.decision.createDevelopedProposal({
      processInstanceId: instanceId,
      sourceProposalIds: [source.id],
      proposalData: { title: 'First' },
    });
    testData.trackProfileForCleanup(first.profileId);
    const second = await caller.decision.createDevelopedProposal({
      processInstanceId: instanceId,
      sourceProposalIds: [source.id],
      proposalData: { title: 'Second' },
    });
    testData.trackProfileForCleanup(second.profileId);

    await expect(readDevelopedSourceIds(first.id)).resolves.toEqual([
      source.id,
    ]);
    await expect(readDevelopedSourceIds(second.id)).resolves.toEqual([
      source.id,
    ]);
  });

  it('copies the mapped fragments of the source into the entry, budget and category included, and keeps an over-long title', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, source } = await createDevelopPhaseSetup({
      testData,
    });
    await configurePrefill({
      instanceId,
      sourceId: source.id,
      summary: 'Plant trees along the river.',
    });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const draft = await caller.decision.createDevelopedProposal({
      processInstanceId: instanceId,
      sourceProposalIds: [source.id],
      proposalData: { title: 'Sent by the list' },
    });
    testData.trackProfileForCleanup(draft.profileId);

    // The mapped title wins and is not cut to the entry form's 20 characters.
    expect(draft.profile.name).toBe(SOURCE_TITLE);
    // The system fields are stored as the editor's autosave stores them.
    await expect(readProposalData(draft.id)).resolves.toMatchObject({
      title: SOURCE_TITLE,
      category: ['Parks'],
      budget: { amount: 500, currency: 'USD' },
    });
    await expect(readEntryDocument(draft.id)).resolves.toEqual({
      title: textFragment(SOURCE_TITLE),
      description: textFragment('Plant trees along the river.'),
      category: textFragment('Parks'),
      budget: textFragment(SOURCE_BUDGET),
    });
  });

  it('keeps the copied budget fragment over the value it would write', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, source } = await createDevelopPhaseSetup({
      testData,
    });
    await configurePrefill({
      instanceId,
      sourceId: source.id,
      summary: 'Plant trees along the river.',
    });
    // Key order differs from the written `{ amount, currency }`.
    const sourceBudget = '{"currency":"USD","amount":500}';
    await seedCollabFragments(source.id, {
      title: SOURCE_TITLE,
      budget: sourceBudget,
    });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const draft = await caller.decision.createDevelopedProposal({
      processInstanceId: instanceId,
      sourceProposalIds: [source.id],
      proposalData: {},
    });
    testData.trackProfileForCleanup(draft.profileId);

    await expect(readProposalData(draft.id)).resolves.toMatchObject({
      budget: { amount: 500, currency: 'USD' },
    });
    await expect(readEntryDocument(draft.id)).resolves.toMatchObject({
      budget: textFragment(sourceBudget),
    });
  });

  it('copies a formatted source field with its formatting', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, source } = await createDevelopPhaseSetup({
      testData,
    });
    await configurePrefill({
      instanceId,
      sourceId: source.id,
      summary: 'Plant trees along the river.',
    });
    const formattedSummary = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Plant ' },
            { type: 'text', text: 'trees', marks: [{ type: 'bold' }] },
            {
              type: 'text',
              text: ' by the river',
              marks: [
                { type: 'link', attrs: { href: 'https://example.org/river' } },
              ],
            },
          ],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Oaks' }],
                },
              ],
            },
          ],
        },
      ],
    };
    mockCollab.setDocFragmentResponses(`proposal-${source.id}`, {
      title: textFragment(SOURCE_TITLE),
      summary: formattedSummary,
    });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const draft = await caller.decision.createDevelopedProposal({
      processInstanceId: instanceId,
      sourceProposalIds: [source.id],
      proposalData: {},
    });
    testData.trackProfileForCleanup(draft.profileId);

    await expect(readEntryDocument(draft.id)).resolves.toMatchObject({
      title: textFragment(SOURCE_TITLE),
      description: formattedSummary,
    });
  });

  it('fills the entry from the other sources when one source document cannot be read', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const {
      setup,
      instanceId,
      source,
      otherSources: [unreadable],
    } = await createDevelopPhaseSetup({ testData, sourceCount: 2 });
    if (!unreadable) {
      throw new Error('Expected a second source');
    }
    await configurePrefill({
      instanceId,
      sourceId: source.id,
      summary: 'Plant trees along the river.',
    });
    const unreadableDocId = `proposal-${unreadable.id}`;
    await db
      .update(proposals)
      .set({ proposalData: { collaborationDocId: unreadableDocId } })
      .where(eq(proposals.id, unreadable.id));
    mockCollab.setDocError(
      unreadableDocId,
      new Error('Collaboration server unavailable'),
    );
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const draft = await caller.decision.createDevelopedProposal({
      processInstanceId: instanceId,
      // The unreadable source first, so its failure comes before the copy.
      sourceProposalIds: [unreadable.id, source.id],
      proposalData: {},
    });
    testData.trackProfileForCleanup(draft.profileId);

    expect(draft.profile.name).toBe(SOURCE_TITLE);
    await expect(readEntryDocument(draft.id)).resolves.toEqual({
      title: textFragment(SOURCE_TITLE),
      description: textFragment('Plant trees along the river.'),
      category: textFragment('Parks'),
      budget: textFragment(SOURCE_BUDGET),
    });
  });

  it('keeps an over-long text value as it is', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, source } = await createDevelopPhaseSetup({
      testData,
    });
    const summary = 'Plant trees along the river. '.repeat(20).trim();
    await configurePrefill({ instanceId, sourceId: source.id, summary });
    const entrySchemaRow = await insertFormSchema({
      processInstanceId: instanceId,
      name: 'Short entry',
      schema: {
        ...prefillEntrySchema,
        properties: {
          ...prefillEntrySchema.properties,
          description: {
            ...prefillEntrySchema.properties.description,
            maxLength: 40,
          },
        },
      },
    });
    await configureDevelopPhase(instanceId, {
      formSchemaId: entrySchemaRow.id,
    });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const draft = await caller.decision.createDevelopedProposal({
      processInstanceId: instanceId,
      sourceProposalIds: [source.id],
      proposalData: {},
    });
    testData.trackProfileForCleanup(draft.profileId);

    await expect(readEntryDocument(draft.id)).resolves.toMatchObject({
      description: textFragment(summary),
    });
  });

  it('seeds no document field for a string from a nested source path', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, source } = await createDevelopPhaseSetup({
      testData,
    });
    await configurePrefill({
      instanceId,
      sourceId: source.id,
      summary: 'Plant trees along the river.',
    });
    await configureDevelopPhase(instanceId, {
      developPrefillMappings: sourceToEntry([
        { from: 'title', to: 'title' },
        { from: 'budget.currency', to: 'description' },
      ]),
    });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const draft = await caller.decision.createDevelopedProposal({
      processInstanceId: instanceId,
      sourceProposalIds: [source.id],
      proposalData: {},
    });
    testData.trackProfileForCleanup(draft.profileId);

    // A string can be rich text, so only a copied fragment seeds it.
    await expect(readEntryDocument(draft.id)).resolves.toEqual({
      title: textFragment(SOURCE_TITLE),
      description: EMPTY_FRAGMENT,
      category: EMPTY_FRAGMENT,
      budget: EMPTY_FRAGMENT,
    });
  });

  it('creates an untitled entry when the develop phase has no mappings and no title is sent', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, source } = await createDevelopPhaseSetup({
      testData,
    });
    await seedCollabFragments(source.id, {
      title: SOURCE_TITLE,
      summary: 'Plant trees along the river.',
    });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const draft = await caller.decision.createDevelopedProposal({
      processInstanceId: instanceId,
      sourceProposalIds: [source.id],
      proposalData: {},
    });
    testData.trackProfileForCleanup(draft.profileId);

    expect(draft.status).toBe(ProposalStatus.DRAFT);
    expect(draft.profile.name).toBe('Untitled Proposal');
    await expect(readProposalData(draft.id)).resolves.not.toHaveProperty(
      'category',
    );
    // Nothing created the document.
    await expect(
      createTipTapClient().getDocumentUpdate(`proposal-${draft.id}`),
    ).resolves.toBeNull();
  });

  it('creates the entry without a prefill when a mapping names a field the entry form lacks', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, source } = await createDevelopPhaseSetup({
      testData,
    });
    await configurePrefill({
      instanceId,
      sourceId: source.id,
      summary: 'Plant trees along the river.',
    });
    await configureDevelopPhase(instanceId, {
      developPrefillMappings: sourceToEntry([
        { from: 'title', to: 'title' },
        { from: 'summary', to: 'notOnTheForm' },
      ]),
    });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const draft = await caller.decision.createDevelopedProposal({
      processInstanceId: instanceId,
      sourceProposalIds: [source.id],
      proposalData: { title: 'Sent by the list' },
    });
    testData.trackProfileForCleanup(draft.profileId);

    expect(draft.profile.name).toBe('Sent by the list');
    await expect(
      createTipTapClient().getDocumentUpdate(`proposal-${draft.id}`),
    ).resolves.toBeNull();
  });

  it('creates the entry when its document cannot be seeded', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, source } = await createDevelopPhaseSetup({
      testData,
    });
    const summary = `Seeding fails ${task.id}`;
    await configurePrefill({ instanceId, sourceId: source.id, summary });
    mockCollab.setCreateDocumentError(
      (fragments) =>
        JSON.stringify(fragments.description ?? null).includes(summary),
      new Error('Collaboration server unavailable'),
    );
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const draft = await caller.decision.createDevelopedProposal({
      processInstanceId: instanceId,
      sourceProposalIds: [source.id],
      proposalData: {},
    });
    testData.trackProfileForCleanup(draft.profileId);

    expect(draft.status).toBe(ProposalStatus.DRAFT);
    expect(draft.profile.name).toBe(SOURCE_TITLE);
    await expect(readDevelopedSourceIds(draft.id)).resolves.toEqual([
      source.id,
    ]);
    await expect(
      createTipTapClient().getDocumentUpdate(`proposal-${draft.id}`),
    ).resolves.toBeNull();
  });

  it('writes a prefilled entry under the develop phase form and reads it back with that form', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, source } = await createDevelopPhaseSetup({
      testData,
    });
    const { entryFormSchemaId } = await configurePrefill({
      instanceId,
      sourceId: source.id,
      summary: 'Plant trees along the river.',
    });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const draft = await caller.decision.createDevelopedProposal({
      processInstanceId: instanceId,
      sourceProposalIds: [source.id],
      proposalData: {},
    });
    testData.trackProfileForCleanup(draft.profileId);

    await expect(readFormSchemaId(draft.id)).resolves.toBe(entryFormSchemaId);
    const read = await caller.decision.getProposal({
      profileId: draft.profileId,
    });
    expect(read.proposalTemplate).toEqual(prefillEntrySchema);
  });

  it('writes the entry under the instance template when the develop phase has no form', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, source } = await createDevelopPhaseSetup({
      testData,
    });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const draft = await caller.decision.createDevelopedProposal({
      processInstanceId: instanceId,
      sourceProposalIds: [source.id],
      proposalData: { title: 'Developed' },
    });
    testData.trackProfileForCleanup(draft.profileId);

    await expect(readFormSchemaId(draft.id)).resolves.toBeNull();
  });

  it('fails the create on the foreign key when the develop phase form row is missing', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, source } = await createDevelopPhaseSetup({
      testData,
    });
    const missingId = randomUUID();
    await configureDevelopPhase(instanceId, { formSchemaId: missingId });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.decision.createDevelopedProposal({
        processInstanceId: instanceId,
        sourceProposalIds: [source.id],
        proposalData: { title: 'Refused' },
      }),
    ).rejects.toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
      // Postgres foreign key violation on `proposals.form_schema_id`.
      cause: { cause: { code: '23503' } },
    });
    const instanceProposals = await db.query.proposals.findMany({
      where: { processInstanceId: instanceId },
      columns: { id: true },
    });
    expect(instanceProposals).toEqual([{ id: source.id }]);
  });

  describe('with the sum of review costs', () => {
    const setUpCostTotal = async ({
      testData,
      sourceCount,
    }: {
      testData: TestDecisionsDataManager;
      sourceCount: number;
    }) => {
      const { setup, instanceId, source, otherSources } =
        await createDevelopPhaseSetup({ testData, sourceCount });
      await configureCostTotal(instanceId);
      const caller = await createAuthenticatedCaller(setup.userEmail);
      const reviewers = [
        setup.organization.profileId,
        setup.instance.profileId,
      ] as const;
      const createDraft = async (sourceProposalIds: string[]) => {
        const draft = await caller.decision.createDevelopedProposal({
          processInstanceId: instanceId,
          sourceProposalIds,
          proposalData: {},
        });
        testData.trackProfileForCleanup(draft.profileId);
        return readProposalData(draft.id);
      };
      return {
        instanceId,
        sources: [source, ...otherSources],
        reviewers,
        createDraft,
      };
    };

    it('prefills the budget with the cost total of the one submitted review of the source, rounded to the cent, past a draft review, a review of another phase and a review of another proposal', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const { instanceId, sources, reviewers, createDraft } =
        await setUpCostTotal({ testData, sourceCount: 2 });
      const [source, unrelated] = sources;
      if (!source || !unrelated) {
        throw new Error('Expected two sources');
      }
      await Promise.all([
        createCostReview({
          instanceId,
          proposalId: source.id,
          reviewerProfileId: reviewers[0],
          answers: {
            cost_design: usd(50322.58),
            cost_construction: usd(289354.84),
            cost_contingency: usd(50322.58),
          },
        }),
        createCostReview({
          instanceId,
          proposalId: source.id,
          reviewerProfileId: reviewers[1],
          answers: { cost_design: usd(9999) },
          state: ProposalReviewState.DRAFT,
        }),
        createCostReview({
          instanceId,
          proposalId: source.id,
          reviewerProfileId: reviewers[1],
          answers: { cost_design: usd(7777) },
          phaseId: 'final',
        }),
        createCostReview({
          instanceId,
          proposalId: unrelated.id,
          reviewerProfileId: reviewers[0],
          answers: { cost_construction: usd(5000) },
        }),
      ]);

      await expect(createDraft([source.id])).resolves.toHaveProperty('budget', {
        amount: 390000,
        currency: DEFAULT_MONEY_CURRENCY,
      });
    });

    it('writes the prefilled budget into the entry document, where the submit validation reads the stored budget', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const { setup, instanceId, source } = await createDevelopPhaseSetup({
        testData,
      });
      await configureCostTotal(instanceId);
      await createCostReview({
        instanceId,
        proposalId: source.id,
        reviewerProfileId: setup.organization.profileId,
        answers: { cost_design: usd(1200.5), cost_construction: usd(3000) },
      });
      const caller = await createAuthenticatedCaller(setup.userEmail);

      const draft = await caller.decision.createDevelopedProposal({
        processInstanceId: instanceId,
        sourceProposalIds: [source.id],
        proposalData: {},
      });
      testData.trackProfileForCleanup(draft.profileId);

      const budget = { amount: 4200.5, currency: DEFAULT_MONEY_CURRENCY };
      await expect(readProposalData(draft.id)).resolves.toHaveProperty(
        'budget',
        budget,
      );
      // One paragraph, whose plain text is what the validation reads.
      const writtenText = JSON.stringify(budget);
      await expect(readEntryDocument(draft.id)).resolves.toMatchObject({
        budget: textFragment(writtenText),
      });
      expect(
        assembleProposalData(budgetTemplate, { budget: writtenText }),
      ).toEqual({ budget });
    });

    it('leaves the budget empty when the source has two submitted reviews', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const { instanceId, sources, reviewers, createDraft } =
        await setUpCostTotal({ testData, sourceCount: 1 });
      const [source] = sources;
      if (!source) {
        throw new Error('Expected a source');
      }
      await Promise.all(
        reviewers.map((reviewerProfileId) =>
          createCostReview({
            instanceId,
            proposalId: source.id,
            reviewerProfileId,
            answers: { cost_construction: usd(5000) },
          }),
        ),
      );

      await expect(createDraft([source.id])).resolves.not.toHaveProperty(
        'budget',
      );
    });

    it('leaves the budget of a merged entry empty, also when its sources give the same total', async ({
      task,
      onTestFinished,
    }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const { instanceId, sources, reviewers, createDraft } =
        await setUpCostTotal({ testData, sourceCount: 2 });
      const [garden, benches] = sources;
      if (!garden || !benches) {
        throw new Error('Expected two sources');
      }
      await Promise.all(
        [garden, benches].map((source) =>
          createCostReview({
            instanceId,
            proposalId: source.id,
            reviewerProfileId: reviewers[0],
            answers: { cost_construction: usd(5000) },
          }),
        ),
      );

      await expect(
        createDraft([garden.id, benches.id]),
      ).resolves.not.toHaveProperty('budget');
    });
  });
});
