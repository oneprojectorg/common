import { mockCollab } from '@op/collab/testing';
import { Visibility } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
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

    // Create a user without access to the instance (member of the org but not the instance)
    const unauthorizedUser = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [], // No access to any instance
    });

    const unauthorizedCaller = await createAuthenticatedCaller(
      unauthorizedUser.email,
    );

    await expect(
      unauthorizedCaller.decision.listProposals({
        processInstanceId: instance.instance.id,
      }),
    ).rejects.toMatchObject({ cause: { name: 'AccessControlException' } });
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
      content: mockTipTapContent.content,
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
      content: mockContent1.content,
    });
    expect(found2?.documentContent).toEqual({
      type: 'json',
      content: mockContent2.content,
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

    const { collaborationDocId } = collabProposal.proposalData as {
      collaborationDocId: string;
    };

    const mockTipTapContent = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'TipTap' }] },
      ],
    };
    // Only set up mock for the collab proposal (empty and legacy won't have valid responses)
    mockCollab.setDocResponse(collaborationDocId, mockTipTapContent);

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
      content: mockTipTapContent.content,
    });
    expect(foundLegacy?.documentContent).toEqual({
      type: 'html',
      content: '<p>HTML</p>',
    });
    // Empty proposal has a collaborationDocId but no mock response, so documentContent is undefined
    expect(foundEmpty?.documentContent).toBeUndefined();
  });
});
