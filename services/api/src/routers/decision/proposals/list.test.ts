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
        callerEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'First Proposal', description: 'Description 1' },
      }),
      testData.createProposal({
        callerEmail: setup.userEmail,
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
      callerEmail: memberUser.email,
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
        callerEmail: setup.userEmail,
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
        callerEmail: submitter.email,
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
          callerEmail: setup.userEmail,
          processInstanceId: instance.instance.id,
          proposalData: { title: 'Visible Proposal', description: 'A test' },
        }),
        testData.createProposal({
          callerEmail: setup.userEmail,
          processInstanceId: instance.instance.id,
          proposalData: { title: 'Hidden Proposal', description: 'A test' },
        }),
        createAuthenticatedCaller(setup.userEmail),
        testData.createMemberUser({
          organization: setup.organization,
          instanceProfileIds: [instance.profileId],
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
    const [, hiddenProposal, adminCaller] = await Promise.all([
      testData.createProposal({
        callerEmail: memberUser.email,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'Visible Proposal', description: 'A test' },
      }),
      testData.createProposal({
        callerEmail: memberUser.email,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'Hidden Proposal', description: 'A test' },
      }),
      createAuthenticatedCaller(setup.userEmail),
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
      callerEmail: submitter.email,
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
        callerEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'Proposal 1', description: 'Desc 1' },
      }),
      testData.createProposal({
        callerEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'Proposal 2', description: 'Desc 2' },
      }),
      testData.createProposal({
        callerEmail: setup.userEmail,
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
        callerEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: {
          title: 'New Format Proposal',
        },
      }),
      // Legacy format: uses description field (HTML content)
      testData.createProposal({
        callerEmail: setup.userEmail,
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
      callerEmail: setup.userEmail,
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
        callerEmail: setup.userEmail,
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
      callerEmail: setup.userEmail,
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
        callerEmail: setup.userEmail,
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
        callerEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'Proposal 1' },
      }),
      testData.createProposal({
        callerEmail: setup.userEmail,
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
        callerEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'Collab' },
      }),
      testData.createProposal({
        callerEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'Legacy', description: '<p>HTML</p>' },
      }),
      testData.createProposal({
        callerEmail: setup.userEmail,
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

    // 3. Create proposals and raw-patch their data to simulate legacy DB state
    const [proposalA, proposalB] = await Promise.all([
      testData.createProposal({
        callerEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'Legacy A' },
      }),
      testData.createProposal({
        callerEmail: setup.userEmail,
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
      category: 'Infrastructure',
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
      category: 'Education',
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
        callerEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'New Schema' },
      }),
      testData.createProposal({
        callerEmail: setup.userEmail,
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
});
