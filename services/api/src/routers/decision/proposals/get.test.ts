import { mockCollab } from '@op/collab/testing';
import { db } from '@op/db/client';
import {
  Visibility,
  decisionProcesses,
  processInstances,
  proposals,
} from '@op/db/schema';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { transformFormDataToProcessSchema as cowopSchema } from '../../../../../../apps/app/src/components/Profile/CreateDecisionProcessModal/schemas/cowop';
import { transformFormDataToProcessSchema as horizonSchema } from '../../../../../../apps/app/src/components/Profile/CreateDecisionProcessModal/schemas/horizon';
import { transformFormDataToProcessSchema as simpleSchema } from '../../../../../../apps/app/src/components/Profile/CreateDecisionProcessModal/schemas/simple';
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

describe.concurrent('getProposal', () => {
  it('should return a proposal with its content by profileId', async ({
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

    const proposalData = {
      title: 'Community Garden Project',
      description: 'A proposal to create a community garden in the park',
      budget: 5000,
      timeline: '3 months',
    };

    const proposal = await testData.createProposal({
      callerEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData,
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.getProposal({
      profileId: proposal.profileId,
    });

    expect(result.id).toBe(proposal.id);
    expect(result.profileId).toBe(proposal.profileId);
    expect(result.processInstanceId).toBe(instance.instance.id);
    expect(result.proposalData).toMatchObject({
      title: 'Community Garden Project',
      description: 'A proposal to create a community garden in the park',
      budget: { amount: 5000, currency: 'USD' },
      timeline: '3 months',
    });
  });

  it('should include isEditable for admin users', async ({
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
      proposalData: { title: 'Test Proposal', description: 'A test proposal' },
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.getProposal({
      profileId: proposal.profileId,
    });

    expect(result.isEditable).toBe(true);
  });

  it('should set isEditable to false for non-admin users who are not owners', async ({
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

    // Create two non-admin members in parallel
    const [memberA, memberB] = await Promise.all([
      testData.createMemberUser({
        organization: setup.organization,
        instanceProfileIds: [instance.profileId],
      }),
      testData.createMemberUser({
        organization: setup.organization,
        instanceProfileIds: [instance.profileId],
      }),
    ]);

    // MemberA creates a proposal
    const proposal = await testData.createProposal({
      callerEmail: memberA.email,
      processInstanceId: instance.instance.id,
      proposalData: {
        title: 'Test Proposal',
        description: 'A test proposal',
      },
    });

    // MemberB should not be able to edit memberA's proposal
    const memberBCaller = await createAuthenticatedCaller(memberB.email);

    const result = await memberBCaller.decision.getProposal({
      profileId: proposal.profileId,
    });

    expect(result.isEditable).toBe(false);
  });

  it('should allow proposal owner to edit their own proposal', async ({
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

    // Create a member who will submit a proposal
    const submitter = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });

    // Submitter creates their own proposal
    const proposal = await testData.createProposal({
      callerEmail: submitter.email,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'My Proposal', description: 'My description' },
    });

    const submitterCaller = await createAuthenticatedCaller(submitter.email);

    const result = await submitterCaller.decision.getProposal({
      profileId: proposal.profileId,
    });

    expect(result.isEditable).toBe(true);
  });

  it('should throw NotFoundError for non-existent proposal', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 0,
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.decision.getProposal({
        profileId: '00000000-0000-0000-0000-000000000000',
      }),
    ).rejects.toMatchObject({ cause: { name: 'NotFoundError' } });
  });

  it('should return hidden proposal to admin', async ({
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
      proposalData: { title: 'Hidden Proposal', description: 'A test' },
    });

    const adminCaller = await createAuthenticatedCaller(setup.userEmail);

    // Hide the proposal
    await adminCaller.decision.updateProposal({
      proposalId: proposal.id,
      data: { visibility: Visibility.HIDDEN },
    });

    // Admin should still be able to get the hidden proposal
    const result = await adminCaller.decision.getProposal({
      profileId: proposal.profileId,
    });

    expect(result.id).toBe(proposal.id);
    expect(result.visibility).toBe(Visibility.HIDDEN);
  });

  it('should return hidden proposal to its owner', async ({
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

    // Create a member who will submit a proposal and admin caller in parallel
    const [submitter, adminCaller] = await Promise.all([
      testData.createMemberUser({
        organization: setup.organization,
        instanceProfileIds: [instance.profileId],
      }),
      createAuthenticatedCaller(setup.userEmail),
    ]);

    const proposal = await testData.createProposal({
      callerEmail: submitter.email,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'My Proposal', description: 'My description' },
    });

    // Admin hides the proposal
    await adminCaller.decision.updateProposal({
      proposalId: proposal.id,
      data: { visibility: Visibility.HIDDEN },
    });

    // Owner should still be able to get their hidden proposal
    const submitterCaller = await createAuthenticatedCaller(submitter.email);
    const result = await submitterCaller.decision.getProposal({
      profileId: proposal.profileId,
    });

    expect(result.id).toBe(proposal.id);
    expect(result.visibility).toBe(Visibility.HIDDEN);
  });

  it('should return json documentContent when collaborationDocId exists and doc is fetched', async ({
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

    // Create proposal first to get the API-generated collaborationDocId
    const proposal = await testData.createProposal({
      callerEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: {
        title: 'TipTap Test Proposal',
      },
    });

    const { collaborationDocId } = proposal.proposalData as {
      collaborationDocId: string;
    };

    const mockTipTapContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Rich content from TipTap Cloud' }],
        },
      ],
    };
    mockCollab.setDocResponse(collaborationDocId, mockTipTapContent);

    const caller = await createAuthenticatedCaller(setup.userEmail);
    const result = await caller.decision.getProposal({
      profileId: proposal.profileId,
    });

    expect(result.proposalData).toMatchObject({
      title: 'TipTap Test Proposal',
      collaborationDocId: expect.any(String),
    });
    expect(result.documentContent).toEqual({
      type: 'json',
      fragments: {
        default: mockTipTapContent,
      },
    });
  });

  it('should return undefined documentContent when TipTap returns 404', async ({
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

    // 404 is the default behavior when docId not in docResponses

    const proposal = await testData.createProposal({
      callerEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: {
        title: 'Missing Doc Proposal',
      },
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);
    const result = await caller.decision.getProposal({
      profileId: proposal.profileId,
    });

    expect(result.proposalData).toMatchObject({
      title: 'Missing Doc Proposal',
      collaborationDocId: expect.any(String),
    });
    // When TipTap fetch fails, documentContent is undefined (UI handles error state)
    expect(result.documentContent).toBeUndefined();
  });

  it('should handle legacy proposal data with null fields', async ({
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

    // Create proposal first
    const proposal = await testData.createProposal({
      callerEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: {
        title: 'Legacy Data Test',
      },
    });

    // Simulate legacy data: all optional fields explicitly set to null
    // This mirrors what we found in the production database
    const legacyProposalData = {
      title: 'Legacy Data Test',
      description: null,
      content: null,
      category: null,
      budget: null,
      attachmentIds: null,
      collaborationDocId: null,
      // Include a custom field to test looseObject passthrough
      customLegacyField: 'preserved',
    };

    await db
      .update(proposals)
      .set({ proposalData: legacyProposalData })
      .where(eq(proposals.id, proposal.id));

    const caller = await createAuthenticatedCaller(setup.userEmail);
    const result = await caller.decision.getProposal({
      profileId: proposal.profileId,
    });

    // Should successfully parse without errors
    expect(result.id).toBe(proposal.id);

    // Verify the entire proposalData object
    // All null values are preserved (via .nullish()), except:
    // - attachmentIds: null → [] via transform
    expect(result.proposalData).toEqual({
      title: 'Legacy Data Test',
      description: null,
      content: null,
      category: null,
      budget: null,
      attachmentIds: [],
      collaborationDocId: null,
      customLegacyField: 'preserved', // looseObject preserves extra fields
    });
  });

  /**
   * Legacy schema compatibility tests.
   *
   * The cowop, horizon, and simple decision templates store the proposalTemplate
   * in `decision_processes.process_schema` (not in `instanceData`). The template
   * defines budget as `{ type: 'number' }` with no `x-field-order`. The resolver
   * (`resolveProposalTemplate`) falls back to `process_schema.proposalTemplate`
   * when `instanceData.proposalTemplate` is absent.
   *
   * These tests simulate the production layout: legacy process_schema with
   * proposalTemplate, no proposalTemplate in instanceData, and proposal data
   * stored as either a plain number or an `{ amount, currency }` object.
   *
   * Category uses the legacy `{ type: ['string', 'null'], enum: [..., null] }`
   * format in these templates. The schema is returned as-is —
   * `parseSchemaOptions` handles both `enum` and `oneOf` on the frontend.
   *
   * @see https://github.com/oneprojectorg/common/pull/601#discussion_r2803602140
   */
  it('should parse legacy cowop proposal via process_schema fallback', async ({
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

    // 1. Generate the legacy cowop process_schema using the actual schema function.
    //    Budget is { type: 'number' }, no x-field-order — matching production.
    const cowopProcessSchema = cowopSchema({
      processName: 'COWOP Democratic Budgeting',
      totalBudget: 100000,
      budgetCapAmount: 10000,
      requireBudget: true,
      categories: ['Infrastructure', 'Education'],
    });

    await db
      .update(decisionProcesses)
      .set({ processSchema: cowopProcessSchema })
      .where(eq(decisionProcesses.id, setup.process.id));

    // 2. Remove proposalTemplate from instanceData so resolveProposalTemplate
    //    falls back to process_schema (matching how legacy instances work).
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

    // 3. Create proposal and simulate legacy data with budget as plain number
    const proposal = await testData.createProposal({
      callerEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Cowop Legacy Proposal' },
    });

    await db
      .update(proposals)
      .set({
        proposalData: {
          title: 'Cowop Legacy Proposal',
          description: 'A community garden project',
          budget: 7500,
          category: 'Infrastructure',
          collaborationDocId: null,
        },
      })
      .where(eq(proposals.id, proposal.id));

    const caller = await createAuthenticatedCaller(setup.userEmail);
    const result = await caller.decision.getProposal({
      profileId: proposal.profileId,
    });

    expect(result.id).toBe(proposal.id);
    expect(result.proposalData).toMatchObject({
      title: 'Cowop Legacy Proposal',
      description: 'A community garden project',
      budget: { amount: 7500, currency: 'USD' },
      category: 'Infrastructure',
    });

    // Verify the proposalTemplate was resolved from process_schema.
    // Legacy templates retain their enum format in the schema.
    expect(result.proposalTemplate).toMatchObject({
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        budget: { type: 'number', maximum: 10000 },
        category: {
          type: ['string', 'null'],
          enum: ['Infrastructure', 'Education', null],
        },
      },
    });
  });

  it('should parse legacy horizon proposal via process_schema fallback', async ({
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

    // Generate the legacy horizon process_schema using the actual schema function.
    // Horizon: no categories, budget not required.
    const horizonProcessSchema = horizonSchema({
      processName: 'Horizon Scanning',
      totalBudget: 50000,
      budgetCapAmount: 50000,
      requireBudget: false,
      categories: [],
    });

    await db
      .update(decisionProcesses)
      .set({ processSchema: horizonProcessSchema })
      .where(eq(decisionProcesses.id, setup.process.id));

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

    const proposal = await testData.createProposal({
      callerEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Horizon Legacy Proposal' },
    });

    await db
      .update(proposals)
      .set({
        proposalData: {
          title: 'Horizon Legacy Proposal',
          description: 'A horizon scanning project',
          budget: 25000,
          collaborationDocId: null,
        },
      })
      .where(eq(proposals.id, proposal.id));

    const caller = await createAuthenticatedCaller(setup.userEmail);
    const result = await caller.decision.getProposal({
      profileId: proposal.profileId,
    });

    expect(result.id).toBe(proposal.id);
    expect(result.proposalData).toMatchObject({
      title: 'Horizon Legacy Proposal',
      description: 'A horizon scanning project',
      budget: { amount: 25000, currency: 'USD' },
    });

    // Verify the proposalTemplate was resolved from process_schema
    expect(result.proposalTemplate).toMatchObject({
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        budget: { type: 'number', maximum: 50000 },
      },
    });
  });

  it('should parse legacy simple proposal via process_schema fallback', async ({
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

    // Generate the legacy simple process_schema using the actual schema function.
    // Simple: has categories, budget required.
    const simpleProcessSchema = simpleSchema({
      processName: 'Simple Voting',
      totalBudget: 25000,
      budgetCapAmount: 25000,
      requireBudget: true,
      categories: ['Community', 'Environment'],
    });

    await db
      .update(decisionProcesses)
      .set({ processSchema: simpleProcessSchema })
      .where(eq(decisionProcesses.id, setup.process.id));

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

    const proposal = await testData.createProposal({
      callerEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Simple Legacy Proposal' },
    });

    await db
      .update(proposals)
      .set({
        proposalData: {
          title: 'Simple Legacy Proposal',
          description: 'A simple voting proposal',
          budget: 12000,
          category: 'Community',
          collaborationDocId: null,
        },
      })
      .where(eq(proposals.id, proposal.id));

    const caller = await createAuthenticatedCaller(setup.userEmail);
    const result = await caller.decision.getProposal({
      profileId: proposal.profileId,
    });

    expect(result.id).toBe(proposal.id);
    expect(result.proposalData).toMatchObject({
      title: 'Simple Legacy Proposal',
      description: 'A simple voting proposal',
      budget: { amount: 12000, currency: 'USD' },
      category: 'Community',
    });

    // Verify the proposalTemplate was resolved from process_schema.
    // Legacy templates retain their enum format in the schema.
    expect(result.proposalTemplate).toMatchObject({
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        budget: { type: 'number', maximum: 25000 },
        category: {
          type: ['string', 'null'],
          enum: ['Community', 'Environment', null],
        },
      },
    });
  });

  it('should normalize legacy plain-number budget to {amount, currency} object', async ({
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
      proposalData: { title: 'Plain Number Budget' },
    });

    // Simulate a legacy proposal where budget was stored as a plain number
    // (the shape legacy schemas produce with budget: { type: 'number' })
    await db
      .update(proposals)
      .set({
        proposalData: {
          title: 'Plain Number Budget',
          description: 'Budget stored as raw number',
          budget: 3000,
          collaborationDocId: null,
        },
      })
      .where(eq(proposals.id, proposal.id));

    const caller = await createAuthenticatedCaller(setup.userEmail);
    const result = await caller.decision.getProposal({
      profileId: proposal.profileId,
    });

    expect(result.id).toBe(proposal.id);
    // Plain number should be normalized to { amount, currency: 'USD' }
    expect(result.proposalData).toMatchObject({
      title: 'Plain Number Budget',
      budget: { amount: 3000, currency: 'USD' },
    });
  });

  it('should allow org admin without profile access via org-level fallback', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    // grantAccess: false means the setup creator has no profile-level access,
    // but as the org creator they have the org Admin role which has decisions: READ
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: false,
    });

    const { instance } = setup.instances[0]!;

    const proposal = await testData.createProposal({
      callerEmail: setup.userEmail,
      processInstanceId: instance.id,
      proposalData: { title: 'Org Admin Fallback Proposal' },
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.getProposal({
      profileId: proposal.profileId,
    });

    expect(result.id).toBe(proposal.id);
    expect(result.proposalData).toMatchObject({
      title: 'Org Admin Fallback Proposal',
    });
  });

  it('should allow org member without profile access via org-level fallback', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: false,
    });

    const { instance } = setup.instances[0]!;

    const proposal = await testData.createProposal({
      callerEmail: setup.userEmail,
      processInstanceId: instance.id,
      proposalData: { title: 'Org Member Fallback Proposal' },
    });

    // Member has no profile-level access (instanceProfileIds: []),
    // but the org Member role has decisions: READ so the fallback should pass
    const memberUser = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [],
    });

    const caller = await createAuthenticatedCaller(memberUser.email);

    const result = await caller.decision.getProposal({
      profileId: proposal.profileId,
    });

    expect(result.id).toBe(proposal.id);
    expect(result.proposalData).toMatchObject({
      title: 'Org Member Fallback Proposal',
    });
  });

  it('should allow user with profile access who is not in the organization', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: false,
    });

    const { instance, profileId } = setup.instances[0]!;

    const proposal = await testData.createProposal({
      callerEmail: setup.userEmail,
      processInstanceId: instance.id,
      proposalData: { title: 'Cross-Org Profile Access Proposal' },
    });

    // Create a user in a different org, then grant them profile-level access
    // to the first setup's instance — they are NOT in setup's org
    const otherSetup = await testData.createDecisionSetup({
      instanceCount: 0,
    });

    await testData.grantProfileAccess(
      profileId,
      otherSetup.user.id,
      otherSetup.userEmail,
      false,
    );

    const caller = await createAuthenticatedCaller(otherSetup.userEmail);

    const result = await caller.decision.getProposal({
      profileId: proposal.profileId,
    });

    expect(result.id).toBe(proposal.id);
    expect(result.proposalData).toMatchObject({
      title: 'Cross-Org Profile Access Proposal',
    });
  });

  it('should throw UNAUTHORIZED when user is not in the organization and has no profile access', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: false,
    });

    const { instance } = setup.instances[0]!;

    const proposal = await testData.createProposal({
      callerEmail: setup.userEmail,
      processInstanceId: instance.id,
      proposalData: { title: 'Unauthorized Proposal' },
    });

    // Create a separate setup — this user belongs to a different organization
    const otherSetup = await testData.createDecisionSetup({
      instanceCount: 0,
    });

    const caller = await createAuthenticatedCaller(otherSetup.userEmail);

    await expect(
      caller.decision.getProposal({ profileId: proposal.profileId }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });

  it('should return proposal with attachments when attachments exist', async ({
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

    // Create a proposal
    const proposal = await testData.createProposal({
      callerEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: {
        title: 'Proposal With Attachments',
      },
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    // Upload an attachment to the proposal
    // Using a minimal valid base64 PNG (1x1 transparent pixel)
    const minimalPngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const uploadResult = await caller.decision.uploadProposalAttachment({
      file: minimalPngBase64,
      fileName: 'test-attachment.png',
      mimeType: 'image/png',
      proposalId: proposal.id,
    });

    expect(uploadResult.id).toBeDefined();
    expect(uploadResult.fileName).toBe('test-attachment.png');

    // Fetch the proposal and verify attachments are included
    const result = await caller.decision.getProposal({
      profileId: proposal.profileId,
    });

    expect(result.id).toBe(proposal.id);
    expect(result.attachments).toBeDefined();
    expect(result.attachments).toHaveLength(1);

    const [attachment] = result.attachments ?? [];
    expect(attachment).toMatchObject({
      attachmentId: uploadResult.id,
      proposalId: proposal.id,
      attachment: {
        fileName: 'test-attachment.png',
        mimeType: 'image/png',
        url: expect.stringContaining('http'),
      },
    });
  });
});
