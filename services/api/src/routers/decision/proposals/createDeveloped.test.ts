import { createTipTapClient, mockCollab } from '@op/collab/testing';
import { type PhaseInstanceData, getInstancePhases } from '@op/common';
import {
  TEST_PERMISSION_BITS,
  TestDecisionsDataManager,
  createCategoryReviewerWithTerm,
  createDevelopPhaseSetup,
  createDevelopProposalsMember,
  grantInstanceRole,
  testDevelopSchema,
} from '@op/common/testing';
import {
  ProcessStatus,
  ProposalRelationshipType,
  ProposalStatus,
  processInstances,
  proposalReviewAssignments,
  proposals,
} from '@op/db/schema';
import { ROLES } from '@op/db/seedData/accessControl';
import { db, eq } from '@op/db/test';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import {
  attachFormSchema,
  entrySchema,
  insertFormSchema,
  seedCollabFragments,
} from '../../../test/helpers/formSchemaTestUtils';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../../test/supabase-utils';
import { createCallerFactory } from '../../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

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
  if (instanceData === null || typeof instanceData !== 'object') {
    throw new Error(`Instance ${instanceId} has no instanceData`);
  }
  const phases = getInstancePhases(instanceData).map((phase) =>
    phase.phaseId === 'final' ? { ...phase, ...fields } : phase,
  );
  await db
    .update(processInstances)
    .set({ instanceData: { ...instanceData, phases } })
    .where(eq(processInstances.id, instanceId));
};

/** Writes `formSchemaId` on the develop phase, as the setup script does. */
const pointDevelopPhaseAt = (instanceId: string, formSchemaId: string) =>
  configureDevelopPhase(instanceId, { formSchemaId });

const readFormSchemaId = async (proposalId: string) => {
  const row = await db.query.proposals.findFirst({
    where: { id: proposalId },
    columns: { formSchemaId: true },
  });
  return row?.formSchemaId;
};

const originFormSchema = {
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

/** The entry form: a short title cap, a description, a category, a budget. */
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

/**
 * Writes the origin's document under the origin form, points the develop
 * phase at the entry form, and maps title, summary, category and budget.
 */
const configurePrefill = async ({
  instanceId,
  sourceId,
  summary,
}: {
  instanceId: string;
  sourceId: string;
  summary: string;
}) => {
  const [originRow, entryRow] = await Promise.all([
    insertFormSchema({
      processInstanceId: instanceId,
      name: 'Origin',
      schema: originFormSchema,
    }),
    insertFormSchema({
      processInstanceId: instanceId,
      name: 'Ballot entry',
      schema: prefillEntrySchema,
    }),
  ]);
  await attachFormSchema(sourceId, originRow.id);
  await seedCollabFragments(sourceId, {
    title: 'Riverside community garden expansion',
    summary,
    category: 'Parks',
    budget: '{"amount":500,"currency":"USD"}',
  });
  await configureDevelopPhase(instanceId, {
    formSchemaId: entryRow.id,
    developPrefillMappings: [
      {
        from: { type: 'proposal', phaseId: 'initial' },
        to: { type: 'proposal', phaseId: 'final' },
        fields: [
          { from: 'title', to: 'title' },
          { from: 'summary', to: 'description' },
          { from: 'category', to: 'category' },
          { from: 'budget', to: 'budget' },
        ],
      },
    ],
  });
};

const readSeededFragments = (proposalId: string) =>
  createTipTapClient().getDocumentFragments(
    `proposal-${proposalId}`,
    ['title', 'description', 'budget', 'category'],
    { format: 'text' },
  );

const readProposalData = async (proposalId: string) => {
  const row = await db.query.proposals.findFirst({
    where: { id: proposalId },
    columns: { proposalData: true },
  });
  return row?.proposalData;
};

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
      assignedOriginIds: [source.id],
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

  it('gives the draft the form schema row the develop phase points at', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, source } = await createDevelopPhaseSetup({
      testData,
    });
    const row = await insertFormSchema({
      processInstanceId: instanceId,
      name: 'Ballot entry',
      schema: entrySchema,
    });
    await pointDevelopPhaseAt(instanceId, row.id);
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const draft = await caller.decision.createDevelopedProposal({
      processInstanceId: instanceId,
      sourceProposalIds: [source.id],
      proposalData: { title: 'Developed' },
    });
    testData.trackProfileForCleanup(draft.profileId);

    await expect(readFormSchemaId(draft.id)).resolves.toBe(row.id);
    const read = await caller.decision.getProposal({
      profileId: draft.profileId,
    });
    expect(read.formSchemaId).toBe(row.id);
    expect(read.proposalTemplate).toEqual(entrySchema);
  });

  it('leaves the form schema empty when the develop phase has no pointer', async ({
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

  it('refuses before the insert when the phase points at a missing form schema row', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, source } = await createDevelopPhaseSetup({
      testData,
    });
    const missingId = crypto.randomUUID();
    await pointDevelopPhaseAt(instanceId, missingId);
    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.decision.createDevelopedProposal({
        processInstanceId: instanceId,
        sourceProposalIds: [source.id],
        proposalData: { title: 'Refused' },
      }),
    ).rejects.toMatchObject({
      cause: {
        name: 'NotFoundError',
        message: `Form schema with ID '${missingId}' not found.`,
      },
    });
    const instanceProposals = await db.query.proposals.findMany({
      where: { processInstanceId: instanceId },
      columns: { id: true },
    });
    expect(instanceProposals).toEqual([{ id: source.id }]);
  });

  it('prefills the title, category and description from the origin and leaves the budget out', async ({
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

    // The mapped title wins, capped at the entry form's 20 characters.
    expect(draft.profile.name).toBe('Riverside community');
    const stored = await readProposalData(draft.id);
    expect(stored).toMatchObject({
      title: 'Riverside community',
      category: ['Parks'],
    });
    expect(stored).not.toHaveProperty('budget');
    await expect(readSeededFragments(draft.id)).resolves.toEqual({
      title: 'Riverside community',
      description: 'Plant trees along the river.',
      budget: '',
      category: '',
    });
  });

  it('keeps the category the caller sends over the mapped one', async ({
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
      proposalData: { title: 'Sent', category: ['Libraries'] },
    });
    testData.trackProfileForCleanup(draft.profileId);

    await expect(readProposalData(draft.id)).resolves.toMatchObject({
      category: ['Libraries'],
    });
  });

  it('creates the entry as before when the develop phase has no mappings', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, source } = await createDevelopPhaseSetup({
      testData,
    });
    await seedCollabFragments(source.id, {
      title: 'Riverside community garden expansion',
      summary: 'Plant trees along the river.',
    });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const draft = await caller.decision.createDevelopedProposal({
      processInstanceId: instanceId,
      sourceProposalIds: [source.id],
      proposalData: { title: 'Sent by the list' },
    });
    testData.trackProfileForCleanup(draft.profileId);

    expect(draft.profile.name).toBe('Sent by the list');
    await expect(readProposalData(draft.id)).resolves.not.toHaveProperty(
      'category',
    );
    // Nothing created the document, so it is not there to read.
    await expect(readSeededFragments(draft.id)).resolves.toEqual({
      title: '',
      description: '',
      budget: '',
      category: '',
    });
  });

  it('creates the entry unprefilled when a mapping names a field the entry form lacks', async ({
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
      developPrefillMappings: [
        {
          from: { type: 'proposal', phaseId: 'initial' },
          to: { type: 'proposal', phaseId: 'final' },
          fields: [
            { from: 'title', to: 'title' },
            { from: 'summary', to: 'notOnTheForm' },
          ],
        },
      ],
    });
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const draft = await caller.decision.createDevelopedProposal({
      processInstanceId: instanceId,
      sourceProposalIds: [source.id],
      proposalData: { title: 'Sent by the list' },
    });
    testData.trackProfileForCleanup(draft.profileId);

    expect(draft.profile.name).toBe('Sent by the list');
    await expect(readSeededFragments(draft.id)).resolves.toMatchObject({
      title: '',
    });
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
      (fragments) => fragments.description?.text === summary,
      new Error('Collaboration server unavailable'),
    );
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const draft = await caller.decision.createDevelopedProposal({
      processInstanceId: instanceId,
      sourceProposalIds: [source.id],
      proposalData: { title: 'Sent by the list' },
    });
    testData.trackProfileForCleanup(draft.profileId);

    expect(draft.status).toBe(ProposalStatus.DRAFT);
    expect(draft.profile.name).toBe('Riverside community');
    await expect(readDevelopedSourceIds(draft.id)).resolves.toEqual([
      source.id,
    ]);
    await expect(readSeededFragments(draft.id)).resolves.toMatchObject({
      description: '',
    });
  });

  it('lets a develop holder develop an origin assigned to them and refuses one that is not', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, source } = await createDevelopPhaseSetup({
      testData,
    });
    const [assigned, unassigned] = await Promise.all([
      createDevelopProposalsMember({
        testData,
        setup,
        assignedOriginIds: [source.id],
      }),
      createDevelopProposalsMember({ testData, setup }),
    ]);
    const [assignedCaller, unassignedCaller] = await Promise.all([
      createAuthenticatedCaller(assigned.email),
      createAuthenticatedCaller(unassigned.email),
    ]);

    const draft = await assignedCaller.decision.createDevelopedProposal({
      processInstanceId: instanceId,
      sourceProposalIds: [source.id],
      proposalData: { title: 'Developed' },
    });
    testData.trackProfileForCleanup(draft.profileId);

    await expect(readDevelopedSourceIds(draft.id)).resolves.toEqual([
      source.id,
    ]);
    await expect(
      unassignedCaller.decision.createDevelopedProposal({
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

  it('refuses a develop holder whose assignment on the origin is deleted', async ({
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
      assignedOriginIds: [source.id],
    });
    await db
      .update(proposalReviewAssignments)
      .set({ deletedAt: new Date().toISOString() })
      .where(eq(proposalReviewAssignments.proposalId, source.id));
    const caller = await createAuthenticatedCaller(developer.email);

    await expect(
      caller.decision.createDevelopedProposal({
        processInstanceId: instanceId,
        sourceProposalIds: [source.id],
        proposalData: { title: 'Refused' },
      }),
    ).rejects.toMatchObject({
      cause: { name: 'ValidationError' },
    });
  });
});
