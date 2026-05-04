import { mockCollab, textFragment } from '@op/collab/testing';
import { db } from '@op/db/client';
import {
  ProcessStatus,
  ProposalStatus,
  Visibility,
  decisionProcesses,
  processInstances,
  proposals,
  stateTransitionHistory,
} from '@op/db/schema';
import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { transformFormDataToProcessSchema as cowopSchema } from '../../../../../../apps/app/src/components/Profile/CreateDecisionProcessModal/schemas/cowop';
import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import {
  schemaWithPipeline,
  schemaWithoutPipeline,
} from '../../../test/helpers/pipelineSchemas';
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

describe.concurrent('listProposals', () => {
  it('should return proposals for a process instance', async ({
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

    // Create multiple proposals and caller in parallel
    const [proposal1, proposal2, caller] = await Promise.all([
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'First Proposal', description: 'Description 1' },
      }),
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: {
          title: 'Second Proposal',
          description: 'Description 2',
        },
      }),
      createAuthenticatedCaller(setup.userEmail),
    ]);

    const result = await caller.decision.listProposals({
      processInstanceId: instance.instance.id,
    });

    expect(result.proposals).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.hasMore).toBe(false);

    const proposalIds = result.proposals.map((p) => p.id);
    expect(proposalIds).toContain(proposal1.id);
    expect(proposalIds).toContain(proposal2.id);
  });

  it('should include canManageProposals for admin users', async ({
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
    const memberUser = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });

    // Member creates a proposal
    await testData.createProposal({
      userEmail: memberUser.email,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Test Proposal', description: 'A test' },
    });

    // Admin should see canManageProposals as true
    const adminCaller = await createAuthenticatedCaller(setup.userEmail);

    const result = await adminCaller.decision.listProposals({
      processInstanceId: instance.instance.id,
    });

    expect(result.canManageProposals).toBe(true);
  });

  it('should set canManageProposals to false for non-admin users', async ({
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

    // Create proposal and non-admin member in parallel
    const [, memberUser] = await Promise.all([
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'Test Proposal', description: 'A test' },
      }),
      testData.createMemberUser({
        organization: setup.organization,
        instanceProfileIds: [instance.profileId],
      }),
    ]);

    const memberCaller = await createAuthenticatedCaller(memberUser.email);

    const result = await memberCaller.decision.listProposals({
      processInstanceId: instance.instance.id,
    });

    expect(result.canManageProposals).toBe(false);
  });

  it('should include isEditable for proposal owners', async ({
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

    // Submitter creates their own proposal and caller in parallel
    const [proposal, submitterCaller] = await Promise.all([
      testData.createProposal({
        userEmail: submitter.email,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'My Proposal', description: 'My description' },
      }),
      createAuthenticatedCaller(submitter.email),
    ]);

    const result = await submitterCaller.decision.listProposals({
      processInstanceId: instance.instance.id,
    });

    const myProposal = result.proposals.find((p) => p.id === proposal.id);
    expect(myProposal?.isEditable).toBe(true);
  });

  it('should hide proposals with HIDDEN visibility from non-admin users', async ({
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

    // Create visible and hidden proposals, admin caller, and non-admin member in parallel
    const [visibleProposal, hiddenProposal, adminCaller, memberUser] =
      await Promise.all([
        testData.createProposal({
          userEmail: setup.userEmail,
          processInstanceId: instance.instance.id,
          proposalData: { title: 'Visible Proposal' },
        }),
        testData.createProposal({
          userEmail: setup.userEmail,
          processInstanceId: instance.instance.id,
          proposalData: { title: 'Hidden Proposal' },
        }),
        createAuthenticatedCaller(setup.userEmail),
        testData.createMemberUser({
          organization: setup.organization,
          instanceProfileIds: [instance.profileId],
        }),
      ]);

    // Submit both proposals first (drafts are only visible to proposal-level access holders)
    await Promise.all([
      adminCaller.decision.submitProposal({
        proposalId: visibleProposal.id,
      }),
      adminCaller.decision.submitProposal({
        proposalId: hiddenProposal.id,
      }),
    ]);

    // Hide one proposal
    await adminCaller.decision.updateProposal({
      proposalId: hiddenProposal.id,
      data: { visibility: Visibility.HIDDEN },
    });

    const memberCaller = await createAuthenticatedCaller(memberUser.email);

    const result = await memberCaller.decision.listProposals({
      processInstanceId: instance.instance.id,
    });

    // Non-admin should only see visible proposal
    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0]?.id).toBe(visibleProposal.id);
  });

  it('should show hidden proposals to admin users', async ({
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

    // Create a member who will submit proposals
    const memberUser = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });

    // Create visible and hidden proposals (by member) and admin caller in parallel
    const [visibleProposal, hiddenProposal, adminCaller] = await Promise.all([
      testData.createProposal({
        userEmail: memberUser.email,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'Visible Proposal' },
      }),
      testData.createProposal({
        userEmail: memberUser.email,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'Hidden Proposal' },
      }),
      createAuthenticatedCaller(setup.userEmail),
    ]);

    // Submit both proposals via member caller (drafts are only visible to proposal-level access holders)
    const memberCaller = await createAuthenticatedCaller(memberUser.email);
    await Promise.all([
      memberCaller.decision.submitProposal({
        proposalId: visibleProposal.id,
      }),
      memberCaller.decision.submitProposal({
        proposalId: hiddenProposal.id,
      }),
    ]);

    // Admin hides one of the member's proposals
    await adminCaller.decision.updateProposal({
      proposalId: hiddenProposal.id,
      data: { visibility: Visibility.HIDDEN },
    });

    const result = await adminCaller.decision.listProposals({
      processInstanceId: instance.instance.id,
    });

    // Admin should see both proposals (including member's hidden proposal)
    expect(result.proposals).toHaveLength(2);
  });

  it('should show hidden proposals to their owners', async ({
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
      userEmail: submitter.email,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'My Proposal', description: 'My description' },
    });

    // Admin hides the proposal
    await adminCaller.decision.updateProposal({
      proposalId: proposal.id,
      data: { visibility: Visibility.HIDDEN },
    });

    // Owner should still see their hidden proposal
    const submitterCaller = await createAuthenticatedCaller(submitter.email);
    const result = await submitterCaller.decision.listProposals({
      processInstanceId: instance.instance.id,
    });

    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0]?.id).toBe(proposal.id);
    expect(result.proposals[0]?.visibility).toBe(Visibility.HIDDEN);
  });

  it('should support pagination with limit and offset', async ({
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

    // Create 3 proposals and caller in parallel
    const [, , , caller] = await Promise.all([
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'Proposal 1', description: 'Desc 1' },
      }),
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'Proposal 2', description: 'Desc 2' },
      }),
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'Proposal 3', description: 'Desc 3' },
      }),
      createAuthenticatedCaller(setup.userEmail),
    ]);

    // First page
    const page1 = await caller.decision.listProposals({
      processInstanceId: instance.instance.id,
      limit: 2,
      offset: 0,
    });

    expect(page1.proposals).toHaveLength(2);
    expect(page1.total).toBe(3);
    expect(page1.hasMore).toBe(true);

    // Second page
    const page2 = await caller.decision.listProposals({
      processInstanceId: instance.instance.id,
      limit: 2,
      offset: 2,
    });

    expect(page2.proposals).toHaveLength(1);
    expect(page2.total).toBe(3);
    expect(page2.hasMore).toBe(false);
  });

  it('should return parsed proposalData with correct structure for new and legacy proposals', async ({
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

    // Create proposals with different data formats in parallel
    const [newFormatProposal, legacyProposal, caller] = await Promise.all([
      // New format: API generates collaborationDocId
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: {
          title: 'New Format Proposal',
        },
      }),
      // Legacy format: uses description field (HTML content)
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: {
          title: 'Legacy Proposal',
          description: '<p>HTML content from legacy editor</p>',
        },
      }),
      createAuthenticatedCaller(setup.userEmail),
    ]);

    const result = await caller.decision.listProposals({
      processInstanceId: instance.instance.id,
    });

    expect(result.proposals).toHaveLength(2);

    const newFormat = result.proposals.find(
      (p) => p.id === newFormatProposal.id,
    );
    const legacy = result.proposals.find((p) => p.id === legacyProposal.id);

    // New format proposal should have title and API-generated collaborationDocId
    expect(newFormat?.proposalData).toMatchObject({
      title: 'New Format Proposal',
      collaborationDocId: expect.any(String),
    });

    // Legacy proposal should have description (HTML content)
    expect(legacy?.proposalData).toMatchObject({
      title: 'Legacy Proposal',
      description: '<p>HTML content from legacy editor</p>',
    });
  });

  it('should return empty list for instance with no proposals', async ({
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

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.listProposals({
      processInstanceId: instance.instance.id,
    });

    expect(result.proposals).toHaveLength(0);
    expect(result.total).toBe(0);
    expect(result.hasMore).toBe(false);
  });

  it('should throw error when user does not have access to instance', async ({
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
    await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Test Proposal', description: 'A test' },
    });

    // Create a user who is not a member of the organization at all
    const outsiderUser = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [],
    });

    // Remove the user from the organization so they have no org-level access
    const { db, eq, and } = await import('@op/db/client');
    const { organizationUsers } = await import('@op/db/schema');
    await db
      .delete(organizationUsers)
      .where(
        and(
          eq(organizationUsers.authUserId, outsiderUser.authUserId),
          eq(organizationUsers.organizationId, setup.organization.id),
        ),
      );

    const unauthorizedCaller = await createAuthenticatedCaller(
      outsiderUser.email,
    );

    await expect(
      unauthorizedCaller.decision.listProposals({
        processInstanceId: instance.instance.id,
      }),
    ).rejects.toMatchObject({ cause: { name: 'UnauthorizedError' } });
  });

  it('should return html documentContent for legacy proposals with description', async ({
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

    const htmlDescription = '<p>This is <strong>rich</strong> content</p>';

    const [proposal, caller] = await Promise.all([
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: {
          title: 'Legacy Proposal',
          description: htmlDescription,
        },
      }),
      createAuthenticatedCaller(setup.userEmail),
    ]);

    const result = await caller.decision.listProposals({
      processInstanceId: instance.instance.id,
    });

    const foundProposal = result.proposals.find((p) => p.id === proposal.id);
    expect(foundProposal?.documentContent).toEqual({
      type: 'html',
      content: htmlDescription,
    });
  });

  it('should return json documentContent when collaborationDocId exists and TipTap returns content', async ({
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
      userEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: {
        title: 'Collab Proposal',
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
          content: [{ type: 'text', text: 'Hello from TipTap' }],
        },
      ],
    };

    // Configure mock to return TipTap content for the generated docId
    mockCollab.setDocResponse(collaborationDocId, mockTipTapContent);

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.listProposals({
      processInstanceId: instance.instance.id,
    });

    const foundProposal = result.proposals.find((p) => p.id === proposal.id);
    expect(foundProposal?.documentContent).toEqual({
      type: 'json',
      fragments: {
        default: mockTipTapContent,
      },
    });
  });

  it('should return undefined documentContent when TipTap fetch fails', async ({
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

    // Mock returns 404 by default for unknown docIds (no explicit setup needed)

    const [proposal, caller] = await Promise.all([
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: {
          title: 'Failed Fetch Proposal',
        },
      }),
      createAuthenticatedCaller(setup.userEmail),
    ]);

    const result = await caller.decision.listProposals({
      processInstanceId: instance.instance.id,
    });

    const foundProposal = result.proposals.find((p) => p.id === proposal.id);
    // When TipTap fetch fails, documentContent should be undefined
    expect(foundProposal?.documentContent).toBeUndefined();
  });

  it('should fetch multiple TipTap documents in parallel', async ({
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

    // Create proposals first to get API-generated collaborationDocIds
    const [proposal1, proposal2] = await Promise.all([
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'Proposal 1' },
      }),
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'Proposal 2' },
      }),
    ]);

    const { collaborationDocId: docId1 } = proposal1.proposalData as {
      collaborationDocId: string;
    };
    const { collaborationDocId: docId2 } = proposal2.proposalData as {
      collaborationDocId: string;
    };

    const mockContent1 = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Doc 1' }] },
      ],
    };
    const mockContent2 = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Doc 2' }] },
      ],
    };

    mockCollab.setDocResponse(docId1, mockContent1);
    mockCollab.setDocResponse(docId2, mockContent2);

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.listProposals({
      processInstanceId: instance.instance.id,
    });

    const found1 = result.proposals.find((p) => p.id === proposal1.id);
    const found2 = result.proposals.find((p) => p.id === proposal2.id);

    expect(found1?.documentContent).toEqual({
      type: 'json',
      fragments: {
        default: mockContent1,
      },
    });
    expect(found2?.documentContent).toEqual({
      type: 'json',
      fragments: {
        default: mockContent2,
      },
    });
  });

  it('should handle mixed proposal types (collab, legacy, empty)', async ({
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

    // Create proposals first (collab and empty both get API-generated docIds)
    const [collabProposal, legacyProposal, emptyProposal] = await Promise.all([
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'Collab' },
      }),
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'Legacy', description: '<p>HTML</p>' },
      }),
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'Empty' },
      }),
    ]);

    const { collaborationDocId: collabDocId } = collabProposal.proposalData as {
      collaborationDocId: string;
    };
    const { collaborationDocId: emptyDocId } = emptyProposal.proposalData as {
      collaborationDocId: string;
    };

    const mockTipTapContent = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'TipTap' }] },
      ],
    };

    mockCollab.setDocResponse(collabDocId, mockTipTapContent);
    mockCollab.setDocResponse(emptyDocId, { type: 'doc', content: [] });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.listProposals({
      processInstanceId: instance.instance.id,
    });

    const foundCollab = result.proposals.find(
      (p) => p.id === collabProposal.id,
    );
    const foundLegacy = result.proposals.find(
      (p) => p.id === legacyProposal.id,
    );
    const foundEmpty = result.proposals.find((p) => p.id === emptyProposal.id);

    expect(foundCollab?.documentContent).toEqual({
      type: 'json',
      fragments: {
        default: mockTipTapContent,
      },
    });
    expect(foundLegacy?.documentContent).toEqual({
      type: 'html',
      content: '<p>HTML</p>',
    });
    expect(foundEmpty?.documentContent).toEqual({
      type: 'json',
      fragments: {
        default: { type: 'doc', content: [] },
      },
    });
  });

  /**
   * Legacy cowop process_schema fallback with mixed budget formats.
   *
   * Simulates production layout: proposalTemplate lives in
   * `decision_processes.process_schema` (not instanceData), proposals have
   * plain-number budgets and the old `content` field instead of `description`.
   */
  it('should list legacy cowop proposals with budget normalization, content→description compat, and proposalTemplate from process_schema', async ({
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

    // 1. Set legacy cowop process_schema on the decision process
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

    // 2. Strip proposalTemplate from instanceData so resolver falls back to process_schema
    const instanceRecord = await db.query.processInstances.findFirst({
      where: { id: instance.instance.id },
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

    // 3. Create proposals and raw-patch their data to simulate legacy DB state
    const [proposalA, proposalB] = await Promise.all([
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'Legacy A' },
      }),
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'Legacy B' },
      }),
    ]);

    await Promise.all([
      // Plain-number budget + old `content` field (no `description`)
      db
        .update(proposals)
        .set({
          proposalData: {
            title: 'Legacy A',
            content: '<p>body from content field</p>',
            budget: 7500,
            category: 'Infrastructure',
            collaborationDocId: null,
          },
        })
        .where(eq(proposals.id, proposalA.id)),
      // Canonical { amount, currency } budget (new format already in DB)
      db
        .update(proposals)
        .set({
          proposalData: {
            title: 'Legacy B',
            description: '<p>already migrated</p>',
            budget: { amount: 4200, currency: 'EUR' },
            category: 'Education',
            collaborationDocId: null,
          },
        })
        .where(eq(proposals.id, proposalB.id)),
    ]);

    const caller = await createAuthenticatedCaller(setup.userEmail);
    const result = await caller.decision.listProposals({
      processInstanceId: instance.instance.id,
    });

    expect(result.proposals).toHaveLength(2);

    const foundA = result.proposals.find((p) => p.id === proposalA.id);
    const foundB = result.proposals.find((p) => p.id === proposalB.id);

    // Plain number → { amount, currency: 'USD' }
    expect(foundA?.proposalData).toMatchObject({
      title: 'Legacy A',
      description: '<p>body from content field</p>',
      budget: { amount: 7500, currency: 'USD' },
      category: ['Infrastructure'],
    });
    // content→description backward compat
    expect(foundA?.documentContent).toEqual({
      type: 'html',
      content: '<p>body from content field</p>',
    });

    // Canonical budget passes through unchanged
    expect(foundB?.proposalData).toMatchObject({
      title: 'Legacy B',
      budget: { amount: 4200, currency: 'EUR' },
      category: ['Education'],
    });
    expect(foundB?.documentContent).toEqual({
      type: 'html',
      content: '<p>already migrated</p>',
    });
  });

  it('should normalize budgets correctly when listing mixed new-schema and legacy proposals', async ({
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

    // Create proposals via API (new schema — gets collaborationDocId)
    const [newSchemaProposal, legacyProposal] = await Promise.all([
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'New Schema' },
      }),
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'Legacy' },
      }),
    ]);

    // Raw-patch legacy proposal to simulate old DB state:
    // plain-number budget, `content` instead of `description`, custom field, no collaborationDocId
    await db
      .update(proposals)
      .set({
        proposalData: {
          title: 'Legacy',
          content: '<p>old content field</p>',
          budget: 9999,
          collaborationDocId: null,
          customField: 'should survive',
        },
      })
      .where(eq(proposals.id, legacyProposal.id));

    // Set up TipTap mock for the new-schema proposal
    const { collaborationDocId } = newSchemaProposal.proposalData as {
      collaborationDocId: string;
    };
    const mockContent = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'TipTap' }] },
      ],
    };
    mockCollab.setDocResponse(collaborationDocId, mockContent);

    const caller = await createAuthenticatedCaller(setup.userEmail);
    const result = await caller.decision.listProposals({
      processInstanceId: instance.instance.id,
    });

    expect(result.proposals).toHaveLength(2);

    const foundNew = result.proposals.find(
      (p) => p.id === newSchemaProposal.id,
    );
    const foundLegacy = result.proposals.find(
      (p) => p.id === legacyProposal.id,
    );

    // New-schema: collaborationDocId present, TipTap content
    expect(foundNew?.proposalData).toMatchObject({
      title: 'New Schema',
      collaborationDocId: expect.any(String),
    });
    expect(foundNew?.documentContent).toEqual({
      type: 'json',
      fragments: { default: mockContent },
    });

    // Legacy: budget normalized, content→description, custom field preserved
    expect(foundLegacy?.proposalData).toMatchObject({
      title: 'Legacy',
      description: '<p>old content field</p>',
      budget: { amount: 9999, currency: 'USD' },
      customField: 'should survive',
    });
    expect(foundLegacy?.documentContent).toEqual({
      type: 'html',
      content: '<p>old content field</p>',
    });
  });

  /**
   * Proposal-level permission tests
   *
   * These tests verify that listProposals filters results based on
   * proposal-level permissions (profileUsers on proposal.profileId)
   * rather than only instance-level permissions.
   */

  it('should show draft proposals to their creator and invited collaborators (proposal-level access)', async ({
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

    // Create a member who creates a draft proposal and a collaborator
    const [creator, collaborator] = await Promise.all([
      testData.createMemberUser({
        organization: setup.organization,
        instanceProfileIds: [instance.profileId],
      }),
      testData.createMemberUser({
        organization: setup.organization,
        instanceProfileIds: [instance.profileId],
      }),
    ]);

    // Creator makes a proposal (starts as DRAFT)
    const draftProposal = await testData.createProposal({
      userEmail: creator.email,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'My Draft Proposal' },
    });

    // Invite the collaborator to the proposal's profile
    await testData.grantProfileAccess(
      draftProposal.profileId!,
      collaborator.authUserId,
      collaborator.email,
      false,
    );

    // The creator should see their own draft
    const creatorCaller = await createAuthenticatedCaller(creator.email);
    const creatorResult = await creatorCaller.decision.listProposals({
      processInstanceId: instance.instance.id,
    });

    const foundByCreator = creatorResult.proposals.find(
      (p) => p.id === draftProposal.id,
    );
    expect(foundByCreator).toBeDefined();
    expect(foundByCreator?.status).toBe(ProposalStatus.DRAFT);

    // The invited collaborator should also see the draft
    const collaboratorCaller = await createAuthenticatedCaller(
      collaborator.email,
    );
    const collaboratorResult = await collaboratorCaller.decision.listProposals({
      processInstanceId: instance.instance.id,
    });

    const foundByCollaborator = collaboratorResult.proposals.find(
      (p) => p.id === draftProposal.id,
    );
    expect(foundByCollaborator).toBeDefined();
    expect(foundByCollaborator?.status).toBe(ProposalStatus.DRAFT);
  });

  it('should NOT show draft proposals to admins who lack proposal-level access', async ({
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

    // Create a member who creates a draft proposal
    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });

    await testData.createProposal({
      userEmail: member.email,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Member Draft' },
    });

    // Admin does NOT have proposal-level access to this draft
    // Admin should NOT see draft proposals they didn't create
    const adminCaller = await createAuthenticatedCaller(setup.userEmail);
    const result = await adminCaller.decision.listProposals({
      processInstanceId: instance.instance.id,
    });

    // Admin should see zero draft proposals (they have no proposal-level access)
    const drafts = result.proposals.filter(
      (p) => p.status === ProposalStatus.DRAFT,
    );
    expect(drafts).toHaveLength(0);
  });

  it('should NOT show draft proposals to other members who lack proposal-level access', async ({
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

    // Create two members
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

    // Member A creates a draft proposal
    await testData.createProposal({
      userEmail: memberA.email,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Member A Draft' },
    });

    // Member B should NOT see Member A's draft
    const memberBCaller = await createAuthenticatedCaller(memberB.email);
    const result = await memberBCaller.decision.listProposals({
      processInstanceId: instance.instance.id,
    });

    expect(result.proposals).toHaveLength(0);
  });

  it('should show submitted proposals to all users with instance-level access', async ({
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

    // Create a member who submits a proposal
    const submitter = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });

    const proposal = await testData.createProposal({
      userEmail: submitter.email,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Submitted Proposal' },
    });

    // Submit the proposal (changes status from DRAFT to SUBMITTED)
    const submitterCaller = await createAuthenticatedCaller(submitter.email);
    await submitterCaller.decision.submitProposal({
      proposalId: proposal.id,
    });

    // Another member should see the submitted proposal
    const otherMember = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });

    const otherMemberCaller = await createAuthenticatedCaller(
      otherMember.email,
    );
    const result = await otherMemberCaller.decision.listProposals({
      processInstanceId: instance.instance.id,
    });

    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0]?.id).toBe(proposal.id);
    expect(result.proposals[0]?.status).toBe(ProposalStatus.SUBMITTED);
  });

  it('should show submitted proposals to admins', async ({
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

    // Create a member who submits a proposal
    const submitter = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });

    const proposal = await testData.createProposal({
      userEmail: submitter.email,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Submitted Proposal' },
    });

    // Submit the proposal
    const submitterCaller = await createAuthenticatedCaller(submitter.email);
    await submitterCaller.decision.submitProposal({
      proposalId: proposal.id,
    });

    // Admin should see submitted proposals even without proposal-level access
    const adminCaller = await createAuthenticatedCaller(setup.userEmail);
    const result = await adminCaller.decision.listProposals({
      processInstanceId: instance.instance.id,
    });

    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0]?.id).toBe(proposal.id);
    expect(result.proposals[0]?.status).toBe(ProposalStatus.SUBMITTED);
  });

  it('should show draft proposals to collaborators with proposal-level access', async ({
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

    // Create a member who creates a draft proposal
    const creator = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });

    const draftProposal = await testData.createProposal({
      userEmail: creator.email,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Shared Draft' },
    });

    // Create a collaborator and grant them proposal-level access
    const collaborator = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });

    // Grant collaborator access to the proposal's profile
    await testData.grantProfileAccess(
      draftProposal.profileId!,
      collaborator.authUserId,
      collaborator.email,
      false, // member-level access
    );

    // Collaborator should see the draft proposal
    const collaboratorCaller = await createAuthenticatedCaller(
      collaborator.email,
    );
    const result = await collaboratorCaller.decision.listProposals({
      processInstanceId: instance.instance.id,
    });

    const found = result.proposals.find((p) => p.id === draftProposal.id);
    expect(found).toBeDefined();
    expect(found?.status).toBe(ProposalStatus.DRAFT);
  });

  it('should show mix of own drafts and submitted proposals correctly', async ({
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

    // Create two members
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

    // Member A creates a draft and a submitted proposal
    const [draftA, submittedA] = await Promise.all([
      testData.createProposal({
        userEmail: memberA.email,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'Draft A' },
      }),
      testData.createProposal({
        userEmail: memberA.email,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'Submitted A' },
      }),
    ]);

    // Submit one of Member A's proposals
    const memberACaller = await createAuthenticatedCaller(memberA.email);
    await memberACaller.decision.submitProposal({
      proposalId: submittedA.id,
    });

    // Member B creates their own draft
    const draftB = await testData.createProposal({
      userEmail: memberB.email,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Draft B' },
    });

    // Member A should see: their own draft + their submitted proposal
    // Member A should NOT see: Member B's draft
    const resultA = await memberACaller.decision.listProposals({
      processInstanceId: instance.instance.id,
    });

    const resultAIds = resultA.proposals.map((p) => p.id);
    expect(resultAIds).toContain(draftA.id);
    expect(resultAIds).toContain(submittedA.id);
    expect(resultAIds).not.toContain(draftB.id);
    expect(resultA.proposals).toHaveLength(2);

    // Member B should see: their own draft + Member A's submitted proposal
    // Member B should NOT see: Member A's draft
    const memberBCaller = await createAuthenticatedCaller(memberB.email);
    const resultB = await memberBCaller.decision.listProposals({
      processInstanceId: instance.instance.id,
    });

    const resultBIds = resultB.proposals.map((p) => p.id);
    expect(resultBIds).toContain(draftB.id);
    expect(resultBIds).toContain(submittedA.id);
    expect(resultBIds).not.toContain(draftA.id);
    expect(resultB.proposals).toHaveLength(2);
  });

  it('should serve versioned system field fragments for submitted proposals', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
      proposalTemplate: {
        type: 'object',
        'x-field-order': ['title', 'budget', 'category', 'summary'],
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
          category: {
            type: ['string', 'null'],
            title: 'Category',
            'x-format': 'dropdown',
          },
          summary: {
            type: 'string',
            title: 'Summary',
            'x-format': 'long-text',
          },
        },
      },
    });

    const instance = setup.instances[0]!;

    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Stale Title' },
    });

    const { collaborationDocId } = proposal.proposalData as {
      collaborationDocId: string;
    };

    // Latest (live) fragments — should NOT be served for submitted proposals
    mockCollab.setDocFragmentResponses(collaborationDocId, {
      title: textFragment('Latest Title'),
      budget: textFragment('{"amount":999,"currency":"USD"}'),
      category: textFragment('Latest Category'),
      summary: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Latest summary' }],
          },
        ],
      },
    });

    // Pinned version fragments — should be served for submitted proposals
    mockCollab.setVersionedDocFragmentResponses(collaborationDocId, 2, {
      title: textFragment('Pinned Title'),
      budget: textFragment('{"amount":500,"currency":"EUR"}'),
      category: textFragment('Pinned Category'),
      summary: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Pinned summary' }],
          },
        ],
      },
    });

    // Mark proposal as submitted with pinned version
    await db
      .update(proposals)
      .set({
        status: ProposalStatus.SUBMITTED,
        proposalData: {
          ...(proposal.proposalData as Record<string, unknown>),
          collaborationDocVersionId: 2,
        },
      })
      .where(eq(proposals.id, proposal.id));

    const caller = await createAuthenticatedCaller(setup.userEmail);
    const result = await caller.decision.listProposals({
      processInstanceId: instance.instance.id,
    });

    const listedProposal = result.proposals.find((p) => p.id === proposal.id);
    expect(listedProposal).toBeDefined();

    const fragments = (
      listedProposal!.documentContent as {
        type: 'json';
        fragments: Record<string, unknown>;
      }
    ).fragments;
    expect(fragments.title).toEqual(textFragment('Pinned Title'));
    expect(fragments.budget).toEqual(
      textFragment('{"amount":500,"currency":"EUR"}'),
    );
    expect(fragments.category).toEqual(textFragment('Pinned Category'));
  });
});

describe.concurrent('listProposals: phase-scoped proposal visibility', () => {
  it('returns only selected proposals after a transition with a limiting pipeline', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      processSchema: schemaWithPipeline,
      instanceCount: 1,
      status: ProcessStatus.PUBLISHED,
    });
    const instanceId = setup.instances[0]!.instance.id;
    const { userEmail } = setup;
    const caller = await createAuthenticatedCaller(userEmail);

    // Create and submit 3 proposals; the pipeline limits to 2
    for (let i = 1; i <= 3; i++) {
      await testData.createProposal({
        userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `Proposal ${i} ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      });
    }

    await testData.advancePhase({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'review',
    });

    const result = await caller.decision.listProposals({
      processInstanceId: instanceId,
    });

    expect(result.proposals).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  it('returns all proposals after a transition without a pipeline', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      processSchema: schemaWithoutPipeline,
      instanceCount: 1,
      status: ProcessStatus.PUBLISHED,
    });
    const instanceId = setup.instances[0]!.instance.id;
    const { userEmail } = setup;
    const caller = await createAuthenticatedCaller(userEmail);

    for (let i = 1; i <= 3; i++) {
      await testData.createProposal({
        userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `Proposal ${i} ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      });
    }

    await testData.advancePhase({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'review',
    });

    const result = await caller.decision.listProposals({
      processInstanceId: instanceId,
    });

    expect(result.proposals).toHaveLength(3);
    expect(result.total).toBe(3);
  });

  it('excludes soft-deleted proposals from the phase-scoped list', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      processSchema: schemaWithoutPipeline,
      instanceCount: 1,
      status: ProcessStatus.PUBLISHED,
    });
    const instanceId = setup.instances[0]!.instance.id;
    const { userEmail } = setup;
    const caller = await createAuthenticatedCaller(userEmail);

    const [p1, p2] = await Promise.all([
      testData.createProposal({
        userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `Active proposal ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      }),
      testData.createProposal({
        userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `To-be-deleted proposal ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      }),
    ]);

    // Soft-delete the second proposal before transition
    await db
      .update(proposals)
      .set({ deletedAt: new Date().toISOString() })
      .where(eq(proposals.id, p2.id));

    await testData.advancePhase({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'review',
    });

    const result = await caller.decision.listProposals({
      processInstanceId: instanceId,
    });

    // Only the non-deleted proposal should appear
    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0]?.id).toBe(p1.id);
  });

  it('excludes proposals soft-deleted after transition from the phase-scoped list', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      processSchema: schemaWithoutPipeline,
      instanceCount: 1,
      status: ProcessStatus.PUBLISHED,
    });
    const instanceId = setup.instances[0]!.instance.id;
    const { userEmail } = setup;
    const caller = await createAuthenticatedCaller(userEmail);

    const [p1, p2] = await Promise.all([
      testData.createProposal({
        userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `Active proposal ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      }),
      testData.createProposal({
        userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `To-be-deleted after transition ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      }),
    ]);

    // Transition first (both proposals make it into the join table)
    await testData.advancePhase({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'review',
    });

    // Soft-delete after transition
    await db
      .update(proposals)
      .set({ deletedAt: new Date().toISOString() })
      .where(eq(proposals.id, p2.id));

    const result = await caller.decision.listProposals({
      processInstanceId: instanceId,
    });

    // Soft-deleted proposal must be excluded even though it's in the join table
    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0]?.id).toBe(p1.id);
  });

  it('shows the creator their draft when viewing the phase it was created in', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      processSchema: schemaWithoutPipeline,
      instanceCount: 1,
      status: ProcessStatus.PUBLISHED,
    });
    const instanceId = setup.instances[0]!.instance.id;
    const { userEmail } = setup;
    const caller = await createAuthenticatedCaller(userEmail);

    const phase1Draft = await testData.createProposal({
      userEmail,
      processInstanceId: instanceId,
      proposalData: { title: `Phase-1 draft ${task.id}` },
    });

    const phase1Result = await caller.decision.listProposals({
      processInstanceId: instanceId,
      phaseId: 'submission',
    });
    expect(phase1Result.proposals.map((p) => p.id)).toContain(phase1Draft.id);

    await testData.advancePhase({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'review',
    });

    const phase2Draft = await testData.createProposal({
      userEmail,
      processInstanceId: instanceId,
      proposalData: { title: `Phase-2 draft ${task.id}` },
    });

    // No phaseId resolves to the current phase (review); the draft just created
    // there must be visible.
    const currentPhaseResult = await caller.decision.listProposals({
      processInstanceId: instanceId,
    });
    expect(currentPhaseResult.proposals.map((p) => p.id)).toContain(
      phase2Draft.id,
    );
  });

  it('hides a phase-1 draft from the creator after the instance advances to phase 2', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      processSchema: schemaWithoutPipeline,
      instanceCount: 1,
      status: ProcessStatus.PUBLISHED,
    });
    const instanceId = setup.instances[0]!.instance.id;
    const { userEmail } = setup;
    const caller = await createAuthenticatedCaller(userEmail);

    const draft = await testData.createProposal({
      userEmail,
      processInstanceId: instanceId,
      proposalData: { title: `Phase-1 draft ${task.id}` },
    });

    await testData.advancePhase({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'review',
    });

    // Default phaseId resolves to the current phase (review). The phase-1 draft
    // should NOT be visible.
    const reviewResult = await caller.decision.listProposals({
      processInstanceId: instanceId,
    });
    expect(reviewResult.proposals.map((p) => p.id)).not.toContain(draft.id);

    // Explicit phaseId='review' should likewise hide it.
    const reviewExplicit = await caller.decision.listProposals({
      processInstanceId: instanceId,
      phaseId: 'review',
    });
    expect(reviewExplicit.proposals.map((p) => p.id)).not.toContain(draft.id);

    // Querying back at the creation phase should re-surface the draft.
    const submissionResult = await caller.decision.listProposals({
      processInstanceId: instanceId,
      phaseId: 'submission',
    });
    expect(submissionResult.proposals.map((p) => p.id)).toContain(draft.id);
  });

  it('shows all drafts for legacy instances regardless of phaseId', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      processSchema: schemaWithoutPipeline,
      instanceCount: 1,
      status: ProcessStatus.PUBLISHED,
    });
    const instanceId = setup.instances[0]!.instance.id;
    const { userEmail } = setup;
    const caller = await createAuthenticatedCaller(userEmail);

    const draft = await testData.createProposal({
      userEmail,
      processInstanceId: instanceId,
      proposalData: { title: `Legacy draft ${task.id}` },
    });

    // Mark the instance as legacy by stamping `currentStateId` into instanceData.
    const instanceRow = await db._query.processInstances.findFirst({
      where: eq(processInstances.id, instanceId),
    });
    const legacyData = {
      ...((instanceRow?.instanceData as Record<string, unknown> | null) ?? {}),
      currentStateId: 'submission',
    };
    await db
      .update(processInstances)
      .set({ instanceData: legacyData })
      .where(eq(processInstances.id, instanceId));

    // Legacy instances bypass phase scoping for drafts (and non-drafts).
    const result = await caller.decision.listProposals({
      processInstanceId: instanceId,
      phaseId: 'review',
    });
    expect(result.proposals.map((p) => p.id)).toContain(draft.id);
  });

  it('does not leak another user’s phase-scoped draft to a member who lacks proposal-level access', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      processSchema: schemaWithoutPipeline,
      instanceCount: 1,
      status: ProcessStatus.PUBLISHED,
      grantAccess: true,
    });
    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    const [creator, otherMember] = await Promise.all([
      testData.createMemberUser({
        organization: setup.organization,
        instanceProfileIds: [instance.profileId],
      }),
      testData.createMemberUser({
        organization: setup.organization,
        instanceProfileIds: [instance.profileId],
      }),
    ]);

    const draft = await testData.createProposal({
      userEmail: creator.email,
      processInstanceId: instance.instance.id,
      proposalData: { title: `Private draft ${task.id}` },
    });

    const otherCaller = await createAuthenticatedCaller(otherMember.email);
    const result = await otherCaller.decision.listProposals({
      processInstanceId: instance.instance.id,
      phaseId: 'submission',
    });

    // Phase scoping must not bypass the ownership pushdown: another instance
    // member without proposal-level access must not see the creator's draft.
    expect(result.proposals.map((p) => p.id)).not.toContain(draft.id);
  });

  it('shows a phase-scoped draft to an invited collaborator viewing the creation phase', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      processSchema: schemaWithoutPipeline,
      instanceCount: 1,
      status: ProcessStatus.PUBLISHED,
      grantAccess: true,
    });
    const instance = setup.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    const [creator, collaborator] = await Promise.all([
      testData.createMemberUser({
        organization: setup.organization,
        instanceProfileIds: [instance.profileId],
      }),
      testData.createMemberUser({
        organization: setup.organization,
        instanceProfileIds: [instance.profileId],
      }),
    ]);

    const draft = await testData.createProposal({
      userEmail: creator.email,
      processInstanceId: instance.instance.id,
      proposalData: { title: `Shared draft ${task.id}` },
    });

    if (!draft.profileId) {
      throw new Error('Draft proposal missing profileId');
    }

    // Invite the collaborator to the proposal's profile (not the instance's).
    // This is the membership the `profileUsers` subquery in
    // `getPhaseProposalAndDraftIds` resolves against.
    await testData.grantProfileAccess(
      draft.profileId,
      collaborator.authUserId,
      collaborator.email,
      false,
    );

    const collaboratorCaller = await createAuthenticatedCaller(
      collaborator.email,
    );
    const result = await collaboratorCaller.decision.listProposals({
      processInstanceId: instance.instance.id,
      phaseId: 'submission',
    });

    expect(result.proposals.map((p) => p.id)).toContain(draft.id);
  });

  it('places a draft created exactly at the inbound transition timestamp into the new phase (half-open window)', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      processSchema: schemaWithoutPipeline,
      instanceCount: 1,
      status: ProcessStatus.PUBLISHED,
    });
    const instanceId = setup.instances[0]!.instance.id;
    const { userEmail } = setup;
    const caller = await createAuthenticatedCaller(userEmail);

    await testData.advancePhase({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'review',
    });

    const [inbound] = await db
      .select({ transitionedAt: stateTransitionHistory.transitionedAt })
      .from(stateTransitionHistory)
      .where(
        and(
          eq(stateTransitionHistory.processInstanceId, instanceId),
          eq(stateTransitionHistory.toStateId, 'review'),
        ),
      );
    expect(inbound).toBeDefined();

    const draft = await testData.createProposal({
      userEmail,
      processInstanceId: instanceId,
      proposalData: { title: `Boundary draft ${task.id}` },
    });
    // Pin the draft's createdAt to the exact transition timestamp.
    await db
      .update(proposals)
      .set({ createdAt: inbound!.transitionedAt.toISOString() })
      .where(eq(proposals.id, draft.id));

    // The boundary draft must land in the post-transition phase (review), not
    // the pre-transition phase (submission).
    const submissionResult = await caller.decision.listProposals({
      processInstanceId: instanceId,
      phaseId: 'submission',
    });
    expect(submissionResult.proposals.map((p) => p.id)).not.toContain(draft.id);

    const reviewResult = await caller.decision.listProposals({
      processInstanceId: instanceId,
      phaseId: 'review',
    });
    expect(reviewResult.proposals.map((p) => p.id)).toContain(draft.id);
  });
});
