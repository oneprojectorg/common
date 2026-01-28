import { ProposalStatus, Visibility } from '@op/db/schema';
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

describe.concurrent('updateProposal visibility', () => {
  it('should allow admin to hide a proposal', async ({
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

    // Create a proposal via router
    const proposal = await testData.createProposal({
      callerEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Test Proposal', description: 'A test' },
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    // Admin should be able to hide the proposal
    const result = await caller.decision.updateProposal({
      proposalId: proposal.id,
      data: { visibility: Visibility.HIDDEN },
    });

    expect(result.visibility).toBe(Visibility.HIDDEN);
  });

  it('should allow admin to unhide a proposal', async ({
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

    // Create a proposal via router
    const proposal = await testData.createProposal({
      callerEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Test Proposal', description: 'A test' },
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    // First hide it
    await caller.decision.updateProposal({
      proposalId: proposal.id,
      data: { visibility: Visibility.HIDDEN },
    });

    // Then unhide it
    const result = await caller.decision.updateProposal({
      proposalId: proposal.id,
      data: { visibility: Visibility.VISIBLE },
    });

    expect(result.visibility).toBe(Visibility.VISIBLE);
  });

  it('should not allow non-admin to change visibility', async ({
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

    // Create a proposal as the admin via router
    const proposal = await testData.createProposal({
      callerEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Test Proposal', description: 'A test' },
    });

    // Create a non-admin member user with proper setup
    const memberUser = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });

    const nonAdminCaller = await createAuthenticatedCaller(memberUser.email);

    // Non-admin should NOT be able to hide the proposal (should get UNAUTHORIZED error)
    await expect(
      nonAdminCaller.decision.updateProposal({
        proposalId: proposal.id,
        data: { visibility: Visibility.HIDDEN },
      }),
    ).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('should filter hidden proposals from listProposals for non-admins', async ({
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

    // Create two proposals via router
    const visibleProposal = await testData.createProposal({
      callerEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Visible Proposal', description: 'A test' },
    });

    const hiddenProposal = await testData.createProposal({
      callerEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Hidden Proposal', description: 'A test' },
    });

    const adminCaller = await createAuthenticatedCaller(setup.userEmail);

    // Admin hides one proposal
    await adminCaller.decision.updateProposal({
      proposalId: hiddenProposal.id,
      data: { visibility: Visibility.HIDDEN },
    });

    // Create a non-admin member user with proper setup
    const memberUser = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });

    const nonAdminCaller = await createAuthenticatedCaller(memberUser.email);

    // Non-admin should only see the visible proposal
    const result = await nonAdminCaller.decision.listProposals({
      processInstanceId: instance.instance.id,
    });

    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0]?.id).toBe(visibleProposal.id);
  });

  it('should allow proposal owner to see their own hidden proposal', async ({
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

    // Create a non-admin member user who will submit a proposal
    const submitter = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });

    // Submitter creates a proposal via router
    const proposal = await testData.createProposal({
      callerEmail: submitter.email,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'My Proposal', description: 'A test' },
    });

    // Admin hides the proposal
    const adminCaller = await createAuthenticatedCaller(setup.userEmail);
    await adminCaller.decision.updateProposal({
      proposalId: proposal.id,
      data: { visibility: Visibility.HIDDEN },
    });

    // Submitter should still be able to see their own hidden proposal
    const submitterCaller = await createAuthenticatedCaller(submitter.email);
    const result = await submitterCaller.decision.listProposals({
      processInstanceId: instance.instance.id,
    });

    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0]?.id).toBe(proposal.id);
    expect(result.proposals[0]?.visibility).toBe(Visibility.HIDDEN);
  });

  it('should allow admin to see all proposals including hidden ones', async ({
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

    // Create two proposals via router
    await testData.createProposal({
      callerEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Visible Proposal', description: 'A test' },
    });

    const hiddenProposal = await testData.createProposal({
      callerEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Hidden Proposal', description: 'A test' },
    });

    const adminCaller = await createAuthenticatedCaller(setup.userEmail);

    // Admin hides one proposal
    await adminCaller.decision.updateProposal({
      proposalId: hiddenProposal.id,
      data: { visibility: Visibility.HIDDEN },
    });

    // Admin should see both proposals
    const result = await adminCaller.decision.listProposals({
      processInstanceId: instance.instance.id,
    });

    expect(result.proposals).toHaveLength(2);
    expect(result.canManageProposals).toBe(true);
  });
});

describe.concurrent('updateProposal status', () => {
  it('should allow admin to update proposal status to evaluation statuses', async ({
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
      proposalData: { title: 'Test Proposal', description: 'A test' },
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    // Admin should be able to update status to SHORTLISTED
    const result = await caller.decision.updateProposal({
      proposalId: proposal.id,
      data: { status: ProposalStatus.SHORTLISTED },
    });

    expect(result.status).toBe(ProposalStatus.SHORTLISTED);
  });

  it('should allow admin to update proposal status', async ({
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
      proposalData: { title: 'Test Proposal', description: 'A test' },
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.updateProposal({
      proposalId: proposal.id,
      data: { status: ProposalStatus.APPROVED },
    });
    expect(result.status).toBe(ProposalStatus.APPROVED);
  });

  it('should not allow non-admin to change proposal status', async ({
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
      proposalData: { title: 'Test Proposal', description: 'A test' },
    });

    const memberUser = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });

    const nonAdminCaller = await createAuthenticatedCaller(memberUser.email);

    // Non-admin should NOT be able to change status
    await expect(
      nonAdminCaller.decision.updateProposal({
        proposalId: proposal.id,
        data: { status: ProposalStatus.SHORTLISTED },
      }),
    ).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('should reject invalid status values like draft or submitted', async ({
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
      proposalData: { title: 'Test Proposal', description: 'A test' },
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    // Should reject draft status (use submitProposal endpoint instead)
    await expect(
      caller.decision.updateProposal({
        proposalId: proposal.id,
        data: { status: ProposalStatus.DRAFT as never },
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });

    // Should reject submitted status (use submitProposal endpoint instead)
    await expect(
      caller.decision.updateProposal({
        proposalId: proposal.id,
        data: { status: ProposalStatus.SUBMITTED as never },
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('should allow updating both status and visibility together', async ({
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
      proposalData: { title: 'Test Proposal', description: 'A test' },
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.updateProposal({
      proposalId: proposal.id,
      data: {
        status: ProposalStatus.REJECTED,
        visibility: Visibility.HIDDEN,
      },
    });

    expect(result.status).toBe(ProposalStatus.REJECTED);
    expect(result.visibility).toBe(Visibility.HIDDEN);
  });
});
