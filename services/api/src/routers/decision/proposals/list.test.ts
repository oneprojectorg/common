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

    // Create multiple proposals
    const proposal1 = await testData.createProposal({
      callerEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'First Proposal', description: 'Description 1' },
    });

    const proposal2 = await testData.createProposal({
      callerEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Second Proposal', description: 'Description 2' },
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

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

    await testData.createProposal({
      callerEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Test Proposal', description: 'A test' },
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.listProposals({
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

    await testData.createProposal({
      callerEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Test Proposal', description: 'A test' },
    });

    // Create a non-admin member
    const memberUser = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });

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

    // Submitter creates their own proposal
    const proposal = await testData.createProposal({
      callerEmail: submitter.email,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'My Proposal', description: 'My description' },
    });

    const submitterCaller = await createAuthenticatedCaller(submitter.email);

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

    // Create visible and hidden proposals
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

    // Hide one proposal
    const adminCaller = await createAuthenticatedCaller(setup.userEmail);
    await adminCaller.decision.updateProposal({
      proposalId: hiddenProposal.id,
      data: { visibility: Visibility.HIDDEN },
    });

    // Create a non-admin member
    const memberUser = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
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

    // Create visible and hidden proposals
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

    // Hide one proposal
    const adminCaller = await createAuthenticatedCaller(setup.userEmail);
    await adminCaller.decision.updateProposal({
      proposalId: hiddenProposal.id,
      data: { visibility: Visibility.HIDDEN },
    });

    const result = await adminCaller.decision.listProposals({
      processInstanceId: instance.instance.id,
    });

    // Admin should see both proposals
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

    // Create a member who will submit a proposal
    const submitter = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });

    const proposal = await testData.createProposal({
      callerEmail: submitter.email,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'My Proposal', description: 'My description' },
    });

    // Admin hides the proposal
    const adminCaller = await createAuthenticatedCaller(setup.userEmail);
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

    // Create 3 proposals
    await testData.createProposal({
      callerEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Proposal 1', description: 'Desc 1' },
    });

    await testData.createProposal({
      callerEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Proposal 2', description: 'Desc 2' },
    });

    await testData.createProposal({
      callerEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Proposal 3', description: 'Desc 3' },
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

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
});
