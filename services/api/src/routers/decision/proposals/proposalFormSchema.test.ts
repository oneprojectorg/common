import { mockCollab } from '@op/collab/testing';
import { ValidationError, updateProposal } from '@op/common';
import { TestDecisionsDataManager } from '@op/common/testing';
import { db, desc, eq } from '@op/db/client';
import { ProposalStatus, proposalHistory, proposals } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
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

/** The instance template: requires a summary, knows nothing of a ballot description. */
const instanceTemplate = {
  type: 'object',
  required: ['title', 'summary'],
  'x-field-order': ['title', 'summary'],
  properties: {
    title: { type: 'string', title: 'Title', 'x-format': 'short-text' },
    summary: { type: 'string', title: 'Summary', 'x-format': 'long-text' },
  },
};

/** The row's schema: requires a ballot description, has no summary. */
const entrySchema = {
  type: 'object',
  required: ['title', 'ballotDescription'],
  'x-field-order': ['title', 'ballotDescription'],
  properties: {
    title: { type: 'string', title: 'Title', 'x-format': 'short-text' },
    ballotDescription: {
      type: 'string',
      title: 'Ballot description',
      maxLength: 280,
      'x-format': 'long-text',
    },
  },
};

/**
 * Points the proposal at its collaboration document and seeds the document's
 * fragments and versions, so submit validates the fragments against the
 * proposal's template (as `submit.test.ts` does).
 */
async function seedCollabFragments(
  proposalId: string,
  fragments: Record<string, string>,
) {
  const collaborationDocId = `proposal-${proposalId}`;

  await db
    .update(proposals)
    .set({ proposalData: { ...fragments, collaborationDocId } })
    .where(eq(proposals.id, proposalId));

  mockCollab.setDocFragments(collaborationDocId, fragments);
  mockCollab.setVersions(collaborationDocId, [
    { version: 1, createdAt: '2026-03-18T08:50:00.000Z' },
  ]);
}

describe.concurrent('proposal form schema', () => {
  it("given a proposal on a form schema row, when it is submitted, then it is validated against the row's schema and not the instance template", async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      proposalTemplate: instanceTemplate,
    });
    const processInstanceId = setup.instance.instance.id;
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const row = await caller.decision.createFormSchema({
      processInstanceId,
      name: 'Ballot entry',
      schema: entrySchema,
    });

    const [complete, missingBallotDescription, onInstanceTemplate] =
      await Promise.all([
        testData.createProposal({
          userEmail: setup.userEmail,
          processInstanceId,
          proposalData: { title: 'Complete entry' },
          formSchemaId: row.id,
        }),
        testData.createProposal({
          userEmail: setup.userEmail,
          processInstanceId,
          proposalData: { title: 'Entry without ballot description' },
          formSchemaId: row.id,
        }),
        testData.createProposal({
          userEmail: setup.userEmail,
          processInstanceId,
          proposalData: { title: 'Proposal on the instance template' },
        }),
      ]);

    await Promise.all([
      seedCollabFragments(complete.id, {
        title: 'Complete entry',
        ballotDescription: 'A short description for the ballot',
      }),
      seedCollabFragments(missingBallotDescription.id, {
        title: 'Entry without ballot description',
      }),
      seedCollabFragments(onInstanceTemplate.id, {
        title: 'Proposal on the instance template',
        ballotDescription: 'A short description for the ballot',
      }),
    ]);

    // No summary, which only the instance template requires: still submits.
    const submitted = await caller.decision.submitProposal({
      proposalId: complete.id,
    });
    expect(submitted.status).toBe(ProposalStatus.SUBMITTED);

    // The row's schema requires the ballot description.
    await expect(
      caller.decision.submitProposal({
        proposalId: missingBallotDescription.id,
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });

    // Control: without the row the instance template still applies.
    await expect(
      caller.decision.submitProposal({ proposalId: onInstanceTemplate.id }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });
  });

  it('given one proposal on a row and one without, when they are read and listed, then each carries its own template', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      proposalTemplate: instanceTemplate,
    });
    const processInstanceId = setup.instance.instance.id;
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const row = await caller.decision.createFormSchema({
      processInstanceId,
      name: 'Ballot entry',
      schema: entrySchema,
    });

    const [onRow, onInstance] = await Promise.all([
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId,
        proposalData: { title: 'On the row' },
        formSchemaId: row.id,
        seedCollabDoc: true,
      }),
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId,
        proposalData: { title: 'On the instance template' },
        seedCollabDoc: true,
      }),
    ]);

    const [readOnRow, readOnInstance] = await Promise.all([
      caller.decision.getProposal({ profileId: onRow.profileId }),
      caller.decision.getProposal({ profileId: onInstance.profileId }),
    ]);

    expect(readOnRow.formSchemaId).toBe(row.id);
    expect(readOnRow.proposalTemplate).toEqual(entrySchema);
    expect(readOnInstance.formSchemaId).toBeNull();
    expect(readOnInstance.proposalTemplate).toEqual(instanceTemplate);

    const list = await caller.decision.listProposals({ processInstanceId });

    expect(list.items).toHaveLength(2);
    const listedOnRow = list.items.find((item) => item.id === onRow.id);
    const listedOnInstance = list.items.find(
      (item) => item.id === onInstance.id,
    );
    expect(listedOnRow?.formSchemaId).toBe(row.id);
    expect(listedOnRow?.proposalTemplate).toEqual(entrySchema);
    expect(listedOnInstance?.formSchemaId).toBeNull();
    expect(listedOnInstance?.proposalTemplate).toEqual(instanceTemplate);
  });

  it('given a proposal on a row, when an update names a different form schema, then it is refused, and the same one is accepted', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      proposalTemplate: instanceTemplate,
    });
    const processInstanceId = setup.instance.instance.id;
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const row = await caller.decision.createFormSchema({
      processInstanceId,
      name: 'Ballot entry',
      schema: entrySchema,
    });
    const otherRow = await caller.decision.createFormSchema({
      processInstanceId,
      name: 'Ballot entry',
      schema: { ...entrySchema, required: ['title'] },
      parentId: row.id,
    });

    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId,
      proposalData: { title: 'Entry' },
      formSchemaId: row.id,
    });

    await expect(
      caller.decision.updateProposal({
        proposalId: proposal.id,
        data: { formSchemaId: otherRow.id },
      }),
    ).rejects.toMatchObject({ cause: { name: 'ValidationError' } });

    const unchanged = await caller.decision.updateProposal({
      proposalId: proposal.id,
      data: { formSchemaId: row.id },
    });
    expect(unchanged.formSchemaId).toBe(row.id);

    // The tRPC input only takes a uuid, so clearing the row is checked on the service.
    await expect(
      updateProposal({
        proposalId: proposal.id,
        data: { formSchemaId: null },
        user: setup.user,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('given a row of another instance, when a proposal is created on it, then the row is not found', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 2,
      grantAccess: true,
      proposalTemplate: instanceTemplate,
    });
    const [first, second] = setup.instances;
    if (!first || !second) {
      throw new Error('Expected two instances');
    }
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const otherInstanceRow = await caller.decision.createFormSchema({
      processInstanceId: second.instance.id,
      name: 'Ballot entry',
      schema: entrySchema,
    });

    await expect(
      caller.decision.createProposal({
        processInstanceId: first.instance.id,
        proposalData: { title: 'Entry' },
        formSchemaId: otherInstanceRow.id,
      }),
    ).rejects.toMatchObject({ cause: { name: 'NotFoundError' } });
  });

  it('given a proposal on a row, when its data is updated, then a history row is written and the row link is kept', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      proposalTemplate: instanceTemplate,
    });
    const processInstanceId = setup.instance.instance.id;
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const row = await caller.decision.createFormSchema({
      processInstanceId,
      name: 'Ballot entry',
      schema: entrySchema,
    });

    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId,
      proposalData: { title: 'Entry' },
      formSchemaId: row.id,
    });

    await caller.decision.updateProposal({
      proposalId: proposal.id,
      data: {
        proposalData: {
          title: 'Entry',
          ballotDescription: 'An edited ballot description',
          collaborationDocId: `proposal-${proposal.id}`,
        },
      },
    });

    const latestSnapshot = await db
      .select()
      .from(proposalHistory)
      .where(eq(proposalHistory.id, proposal.id))
      .orderBy(desc(proposalHistory.historyCreatedAt))
      .limit(1)
      .then((rows) => rows[0]);

    expect(latestSnapshot).toBeDefined();
    expect(latestSnapshot?.proposalData).toMatchObject({
      ballotDescription: 'An edited ballot description',
    });

    const stored = await db.query.proposals.findFirst({
      where: { id: proposal.id },
      columns: { formSchemaId: true },
    });
    expect(stored?.formSchemaId).toBe(row.id);
  });

  it('given a row in use by a proposal, when the decision is deleted, then the instance and the row are gone', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      proposalTemplate: instanceTemplate,
    });
    const processInstanceId = setup.instance.instance.id;
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const row = await caller.decision.createFormSchema({
      processInstanceId,
      name: 'Ballot entry',
      schema: entrySchema,
    });

    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId,
      proposalData: { title: 'Entry' },
      formSchemaId: row.id,
    });

    await caller.decision.deleteDecision({ instanceId: processInstanceId });

    const [deletedInstance, deletedRow, deletedProposal] = await Promise.all([
      db.query.processInstances.findFirst({ where: { id: processInstanceId } }),
      db.query.formSchemas.findFirst({ where: { id: row.id } }),
      db.query.proposals.findFirst({ where: { id: proposal.id } }),
    ]);
    expect(deletedInstance).toBeUndefined();
    expect(deletedRow).toBeUndefined();
    expect(deletedProposal).toBeUndefined();
  });

  it('given a chain of row versions in use by a proposal, when the decision is deleted, then every version is gone', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      proposalTemplate: instanceTemplate,
    });
    const processInstanceId = setup.instance.instance.id;
    const caller = await createAuthenticatedCaller(setup.userEmail);

    const parent = await caller.decision.createFormSchema({
      processInstanceId,
      name: 'Ballot entry',
      schema: entrySchema,
    });
    const child = await caller.decision.createFormSchema({
      processInstanceId,
      name: 'Ballot entry',
      schema: { ...entrySchema, required: ['title'] },
      parentId: parent.id,
    });

    await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId,
      proposalData: { title: 'Entry' },
      formSchemaId: child.id,
    });

    await caller.decision.deleteDecision({ instanceId: processInstanceId });

    const remaining = await db.query.formSchemas.findMany({
      where: { processInstanceId },
    });
    expect(remaining).toHaveLength(0);
  });
});
