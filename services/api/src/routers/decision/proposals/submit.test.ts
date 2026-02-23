import { mockCollab } from '@op/collab/testing';
import {
  ProposalStatus,
  decisionProcesses,
  processInstances,
  proposals,
} from '@op/db/schema';
import { db, eq } from '@op/db/test';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { transformFormDataToProcessSchema as cowopSchema } from '../../../../../../apps/app/src/components/Profile/CreateDecisionProcessModal/schemas/cowop';
import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
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

describe.concurrent('submitProposal', () => {
  it('should submit a draft proposal successfully', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    const proposal = await testData.createProposal({
      callerEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: {
        title: 'Valid Proposal',
        description: 'A complete proposal',
      },
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.submitProposal({
      proposalId: proposal.id,
    });

    expect(result.status).toBe(ProposalStatus.SUBMITTED);
  });

  it('should reject submitting an already-submitted proposal', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    const proposal = await testData.createProposal({
      callerEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Already Submitted', description: 'A test' },
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    // First submission should succeed
    await caller.decision.submitProposal({
      proposalId: proposal.id,
    });

    // Second submission should fail — proposal is no longer a draft
    await expect(
      caller.decision.submitProposal({
        proposalId: proposal.id,
      }),
    ).rejects.toMatchObject({
      cause: { name: 'ValidationError' },
    });
  });

  it('should reject submission when current phase disallows proposals', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    const proposal = await testData.createProposal({
      callerEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Phase Blocked', description: 'A test' },
    });

    // Advance instance to the 'final' phase which has proposals.submit = false
    // (testMinimalSchema: initial = submit:true, final = submit:false)
    const instanceRecord = await db.query.processInstances.findFirst({
      where: { id: instance.instance.id },
    });

    if (!instanceRecord) {
      throw new Error('Instance record not found');
    }

    const instanceData = instanceRecord.instanceData as Record<string, unknown>;
    await db
      .update(processInstances)
      .set({
        currentStateId: 'final',
        instanceData: {
          ...instanceData,
          currentPhaseId: 'final',
        },
      })
      .where(eq(processInstances.id, instance.instance.id));

    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.decision.submitProposal({
        proposalId: proposal.id,
      }),
    ).rejects.toMatchObject({
      cause: { name: 'ValidationError' },
    });
  });

  it('should reject submission from a user without access to the decision', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    const proposal = await testData.createProposal({
      callerEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Unauthorized Proposal', description: 'A test' },
    });

    // Create a member user WITHOUT access to this decision's profile
    const outsider = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [], // no access to the instance profile
    });

    const outsiderCaller = await createAuthenticatedCaller(outsider.email);

    await expect(
      outsiderCaller.decision.submitProposal({
        proposalId: proposal.id,
      }),
    ).rejects.toThrow();
  });

  it('should submit successfully when proposal template contains vendor extension keywords', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    // Use a template with x-field-order and x-format vendor extensions,
    // matching real-world templates stored in the database
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      proposalTemplate: {
        type: 'object',
        required: ['title'],
        'x-field-order': ['title', 'budget', 'summary'],
        properties: {
          title: {
            type: 'string',
            title: 'Title',
            'x-format': 'short-text',
          },
          budget: {
            type: 'object',
            title: 'Budget',
            'x-format': 'money',
            properties: {
              amount: { type: 'number' },
              currency: { type: 'string', default: 'USD' },
            },
          },
          summary: {
            type: 'string',
            title: 'Summary',
            'x-format': 'long-text',
          },
        },
      },
    });

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    const proposal = await testData.createProposal({
      callerEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Proposal with vendor extensions' },
    });

    const collaborationDocId = `proposal-${proposal.id}`;

    // Set proposal data with collaborationDocId so submit fetches from TipTap
    await db
      .update(proposals)
      .set({
        proposalData: {
          title: 'Proposal with vendor extensions',
          collaborationDocId,
          budget: { amount: 5000, currency: 'USD' },
          summary:
            'Testing that x-field-order and x-format do not break validation',
        },
      })
      .where(eq(proposals.id, proposal.id));

    // Seed the collaboration doc fragments so validation reads from TipTap
    mockCollab.setDocFragments(collaborationDocId, {
      title: 'Proposal with vendor extensions',
      budget: JSON.stringify({ amount: 5000, currency: 'USD' }),
      summary:
        'Testing that x-field-order and x-format do not break validation',
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.submitProposal({
      proposalId: proposal.id,
    });

    expect(result.status).toBe(ProposalStatus.SUBMITTED);
  });

  it('should reject submission when required fields are missing from proposal data', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      proposalTemplate: {
        type: 'object',
        required: ['title'],
        'x-field-order': ['title'],
        properties: {
          title: { type: 'string', minLength: 1, 'x-format': 'short-text' },
        },
      },
    });

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    // Create a proposal with an empty title
    const proposal = await testData.createProposal({
      callerEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: '' },
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    // submitProposal should validate against the proposalTemplate and reject
    // because title is empty (violates minLength: 1)
    await expect(
      caller.decision.submitProposal({
        proposalId: proposal.id,
      }),
    ).rejects.toMatchObject({
      cause: { name: 'ValidationError' },
    });
  });

  it('should use schema title in validation errors for UUID-keyed custom fields', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    // Template with UUID-keyed custom fields, matching real-world editor output
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      proposalTemplate: {
        type: 'object',
        required: ['title', 'a1b2c3d4', 'e5f6a7b8'],
        'x-field-order': ['title', 'a1b2c3d4', 'e5f6a7b8'],
        properties: {
          title: {
            type: 'string',
            title: 'Proposal title',
            'x-format': 'short-text',
          },
          a1b2c3d4: {
            type: 'string',
            title: 'Project Justification',
            'x-format': 'long-text',
          },
          e5f6a7b8: {
            type: 'object',
            title: 'Estimated Cost',
            'x-format': 'money',
            properties: {
              amount: { type: 'number' },
              currency: { type: 'string', default: 'USD' },
            },
          },
        },
      },
    });

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    // Create proposal with only title — missing the UUID-keyed required fields
    const proposal = await testData.createProposal({
      callerEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Incomplete Proposal' },
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    // Validation error should use "Project Justification" and "Estimated Cost"
    // from the schema title, not the raw UUID keys "a1b2c3d4" / "e5f6a7b8"
    try {
      await caller.decision.submitProposal({
        proposalId: proposal.id,
      });
      expect.unreachable('Should have thrown');
    } catch (error: unknown) {
      const err = error as { cause?: { message?: string } };
      expect(err.cause?.message).toContain('Project Justification is required');
      expect(err.cause?.message).toContain('Estimated Cost is required');
      expect(err.cause?.message).not.toContain('a1b2c3d4');
      expect(err.cause?.message).not.toContain('e5f6a7b8');
    }
  });

  it('should reject submission when budget exceeds the template maximum', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      proposalTemplate: {
        type: 'object',
        required: ['title', 'budget'],
        'x-field-order': ['title', 'budget'],
        properties: {
          title: { type: 'string', 'x-format': 'short-text' },
          budget: {
            type: 'object',
            'x-format': 'money',
            properties: {
              amount: { type: 'number', maximum: 10000 },
              currency: { type: 'string', default: 'USD' },
            },
          },
        },
      },
    });

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    // Create a proposal, then directly overwrite proposalData
    // with a budget that exceeds the template maximum
    const proposal = await testData.createProposal({
      callerEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Over Budget Proposal' },
    });

    const collaborationDocId = `proposal-${proposal.id}`;

    // Directly set invalid proposal data that exceeds the budget cap
    await db
      .update(proposals)
      .set({
        proposalData: {
          title: 'Over Budget Proposal',
          collaborationDocId,
          budget: { amount: 99999, currency: 'USD' },
        },
      })
      .where(eq(proposals.id, proposal.id));

    // Seed the collaboration doc fragments with the over-budget value
    mockCollab.setDocFragments(collaborationDocId, {
      title: 'Over Budget Proposal',
      budget: JSON.stringify({ amount: 99999, currency: 'USD' }),
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    // submitProposal should validate against the template and reject
    // because budget 99999 > maximum 10000
    await expect(
      caller.decision.submitProposal({
        proposalId: proposal.id,
      }),
    ).rejects.toMatchObject({
      cause: { name: 'ValidationError' },
    });
  });

  it('should reject submission when a required text field is empty in the collaboration document', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      proposalTemplate: {
        type: 'object',
        required: ['title', 'summary'],
        'x-field-order': ['title', 'summary'],
        properties: {
          title: {
            type: 'string',
            title: 'Title',
            minLength: 1,
            'x-format': 'short-text',
          },
          summary: {
            type: 'string',
            title: 'Project Summary',
            minLength: 1,
            'x-format': 'long-text',
          },
        },
      },
    });

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    const proposal = await testData.createProposal({
      callerEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Has Title' },
    });

    const collaborationDocId = `proposal-${proposal.id}`;

    await db
      .update(proposals)
      .set({
        proposalData: { title: 'Has Title', collaborationDocId },
      })
      .where(eq(proposals.id, proposal.id));

    // Seed title but leave summary empty — simulates user never filling it in
    mockCollab.setDocFragments(collaborationDocId, {
      title: 'Has Title',
      // summary deliberately omitted
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.decision.submitProposal({ proposalId: proposal.id }),
    ).rejects.toMatchObject({
      cause: { name: 'ValidationError' },
    });
  });

  it('should reject submission when a required money field is missing from the collaboration document', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      proposalTemplate: {
        type: 'object',
        required: ['title', 'budget'],
        'x-field-order': ['title', 'budget'],
        properties: {
          title: {
            type: 'string',
            title: 'Title',
            'x-format': 'short-text',
          },
          budget: {
            type: 'object',
            title: 'Requested Budget',
            'x-format': 'money',
            properties: {
              amount: { type: 'number' },
              currency: { type: 'string', default: 'USD' },
            },
          },
        },
      },
    });

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    const proposal = await testData.createProposal({
      callerEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'No Budget' },
    });

    const collaborationDocId = `proposal-${proposal.id}`;

    await db
      .update(proposals)
      .set({
        proposalData: { title: 'No Budget', collaborationDocId },
      })
      .where(eq(proposals.id, proposal.id));

    // Seed title but no budget fragment
    mockCollab.setDocFragments(collaborationDocId, {
      title: 'No Budget',
      // budget deliberately omitted
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.decision.submitProposal({ proposalId: proposal.id }),
    ).rejects.toMatchObject({
      cause: { name: 'ValidationError' },
    });
  });

  /**
   * Legacy schema compatibility: submit with enum-based category.
   *
   * The cowop template stores category as `{ type: ['string', 'null'], enum: [..., null] }`.
   * After the oneOf migration, new templates use `{ oneOf: [{ const, title }] }`.
   * This test verifies that AJV validation still accepts proposals submitted
   * against the legacy enum-based category schema via process_schema fallback.
   */
  it('should submit successfully with legacy enum-based category template from process_schema', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    // 1. Inject legacy cowop process_schema — category uses enum format,
    //    budget uses plain { type: 'number' }
    const legacyProcessSchema = cowopSchema({
      processName: 'COWOP Legacy Submit',
      totalBudget: 100000,
      budgetCapAmount: 10000,
      requireBudget: true,
      categories: ['Infrastructure', 'Education'],
    });

    await db
      .update(decisionProcesses)
      .set({ processSchema: legacyProcessSchema })
      .where(eq(decisionProcesses.id, setup.process.id));

    // 2. Strip proposalTemplate from instanceData to force process_schema fallback
    const instanceRecord = await db._query.processInstances.findFirst({
      where: eq(processInstances.id, instance.instance.id),
    });

    if (!instanceRecord) {
      throw new Error('Instance record not found');
    }

    const { proposalTemplate: _, ...instanceDataWithoutTemplate } =
      instanceRecord.instanceData as Record<string, unknown>;

    await db
      .update(processInstances)
      .set({ instanceData: instanceDataWithoutTemplate })
      .where(eq(processInstances.id, instance.instance.id));

    // 3. Create proposal with legacy data: plain-number budget + enum category value.
    //    Legacy proposals have no collaborationDocId — the submit path validates
    //    proposalData directly instead of reading from a collaboration document.
    const proposal = await testData.createProposal({
      callerEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Legacy Submit Test' },
    });

    await db
      .update(proposals)
      .set({
        proposalData: {
          title: 'Legacy Submit Test',
          description: 'Testing submit with legacy enum category',
          budget: 5000,
          category: 'Infrastructure',
        },
      })
      .where(eq(proposals.id, proposal.id));

    const caller = await createAuthenticatedCaller(setup.userEmail);

    // Should not throw — AJV validates enum-based category successfully
    const result = await caller.decision.submitProposal({
      proposalId: proposal.id,
    });

    expect(result.status).toBe(ProposalStatus.SUBMITTED);
  });

  it('should submit successfully with new oneOf-based category template', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      proposalTemplate: {
        type: 'object',
        required: ['title'],
        'x-field-order': ['title', 'category'],
        properties: {
          title: {
            type: 'string',
            title: 'Title',
            'x-format': 'short-text',
          },
          category: {
            type: 'string',
            title: 'Category',
            'x-format': 'dropdown',
            oneOf: [
              { const: 'Infrastructure', title: 'Infrastructure' },
              { const: 'Education', title: 'Education' },
            ],
          },
        },
      },
    });

    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    const proposal = await testData.createProposal({
      callerEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'OneOf Category Test' },
    });

    const collaborationDocId = `proposal-${proposal.id}`;

    await db
      .update(proposals)
      .set({
        proposalData: {
          title: 'OneOf Category Test',
          category: 'Infrastructure',
          collaborationDocId,
        },
      })
      .where(eq(proposals.id, proposal.id));

    mockCollab.setDocFragments(collaborationDocId, {
      title: 'OneOf Category Test',
      category: 'Infrastructure',
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.submitProposal({
      proposalId: proposal.id,
    });

    expect(result.status).toBe(ProposalStatus.SUBMITTED);
  });
});
