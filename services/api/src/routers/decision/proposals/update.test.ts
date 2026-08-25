import { mockCollab } from '@op/collab/testing';
import { ProposalStatus, Visibility } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import {
  accessTierGatingCell,
  describeDecisionAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../../test/helpers/gating/decision';
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

    const instance = setup.instance;

    // Create a proposal via router
    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
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

    const instance = setup.instance;

    // Create a proposal via router
    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
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

    const instance = setup.instance;

    // Create a proposal as the admin via router
    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Test Proposal', description: 'A test' },
    });

    // Create a non-admin member user with proper setup
    const memberUser = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });

    const nonAdminCaller = await createAuthenticatedCaller(memberUser.email);

    // Non-admin should NOT be able to hide the proposal
    await expect(
      nonAdminCaller.decision.updateProposal({
        proposalId: proposal.id,
        data: { visibility: Visibility.HIDDEN },
      }),
    ).rejects.toMatchObject({
      cause: { statusCode: 403 },
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

    const instance = setup.instance;

    // Create two proposals via router
    const visibleProposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Visible Proposal' },
    });

    const hiddenProposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Hidden Proposal' },
    });

    const adminCaller = await createAuthenticatedCaller(setup.userEmail);

    // Submit both proposals first (drafts are only visible to proposal-level access holders)
    await Promise.all([
      adminCaller.decision.submitProposal({
        proposalId: visibleProposal.id,
      }),
      adminCaller.decision.submitProposal({
        proposalId: hiddenProposal.id,
      }),
    ]);

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

    const instance = setup.instance;

    // Create a non-admin member user who will submit a proposal
    const submitter = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });

    // Submitter creates a proposal via router
    const proposal = await testData.createProposal({
      userEmail: submitter.email,
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

    const instance = setup.instance;

    // Create two proposals via router
    await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Visible Proposal', description: 'A test' },
    });

    const hiddenProposal = await testData.createProposal({
      userEmail: setup.userEmail,
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

    const instance = setup.instance;

    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
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

    const instance = setup.instance;

    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
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

    const instance = setup.instance;

    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
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
      cause: { statusCode: 403 },
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

    const instance = setup.instance;

    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
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

    const instance = setup.instance;

    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
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

describe.concurrent('updateProposal validation', () => {
  it('should skip validation when proposal is in draft status', async ({
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

    const instance = setup.instance;

    // Proposal is created in DRAFT status by default
    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Draft' },
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    // Updating proposalData on a draft should succeed even with missing required fields
    const result = await caller.decision.updateProposal({
      proposalId: proposal.id,
      data: { proposalData: { title: 'Updated Draft' } },
    });

    expect(result.proposalData).toMatchObject({ title: 'Updated Draft' });
  });

  it('should reject update when required fields are missing from collaboration document on non-draft proposal', async ({
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

    const instance = setup.instance;

    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Draft' },
      status: ProposalStatus.SUBMITTED,
    });

    const collaborationDocId = `proposal-${proposal.id}`;

    // Seed title but omit the required summary field
    mockCollab.setDocFragments(collaborationDocId, {
      title: 'Draft',
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.decision.updateProposal({
        proposalId: proposal.id,
        data: { proposalData: { title: 'Updated Draft' } },
      }),
    ).rejects.toMatchObject({
      cause: { statusCode: 400 },
    });
  });
});

describe.concurrent('updateProposal checkpointVersion', () => {
  it('should stamp collaborationDocVersionId when checkpointVersion is provided on a submitted proposal', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instance;

    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Test Proposal' },
      status: ProposalStatus.SUBMITTED,
    });

    const collaborationDocId = `proposal-${proposal.id}`;

    mockCollab.setDocFragments(collaborationDocId, {
      title: 'Test Proposal',
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.updateProposal({
      proposalId: proposal.id,
      data: {
        proposalData: { title: 'Updated Proposal' },
        checkpointVersion: { type: 'update' },
      },
    });

    expect(
      (result.proposalData as Record<string, unknown>)
        .collaborationDocVersionId,
    ).toBe(1);
  });

  it('should not stamp collaborationDocVersionId when checkpointVersion is omitted', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instance;

    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Test Proposal' },
      status: ProposalStatus.SUBMITTED,
    });

    const collaborationDocId = `proposal-${proposal.id}`;

    mockCollab.setDocFragments(collaborationDocId, {
      title: 'Test Proposal',
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.updateProposal({
      proposalId: proposal.id,
      data: {
        proposalData: { title: 'Updated Proposal' },
      },
    });

    expect(
      (result.proposalData as Record<string, unknown>)
        .collaborationDocVersionId,
    ).toBeUndefined();
  });

  it('should not stamp collaborationDocVersionId on a draft even with checkpointVersion', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instance;

    // Proposal is created in DRAFT status by default
    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Draft Proposal', description: 'A test' },
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.updateProposal({
      proposalId: proposal.id,
      data: {
        proposalData: { title: 'Updated Draft' },
        checkpointVersion: { type: 'update' },
      },
    });

    expect(
      (result.proposalData as Record<string, unknown>)
        .collaborationDocVersionId,
    ).toBeUndefined();
  });
});

/**
 * Who may edit a proposal's structured data: its author, the collaborators it
 * was shared with, and decision admins. Plain process membership must not
 * carry edit rights on somebody else's proposal — Member holds `decisions`
 * UPDATE so it can submit its own work, which is not a claim on anyone
 * else's.
 */
describe.concurrent('updateProposal data authorization', () => {
  it('should allow the author to update their own proposal data', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instance;

    const author = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });

    const proposal = await testData.createProposal({
      userEmail: author.email,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Author Proposal' },
    });

    const authorCaller = await createAuthenticatedCaller(author.email);

    const result = await authorCaller.decision.updateProposal({
      proposalId: proposal.id,
      data: { proposalData: { title: 'Edited by author' } },
    });

    expect(result.proposalData).toMatchObject({ title: 'Edited by author' });
  });

  it('should allow an invited collaborator to update the proposal data', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instance;

    const author = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });

    const proposal = await testData.createProposal({
      userEmail: author.email,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Shared Proposal' },
    });

    // Mirrors an accepted share invite: the Member role on the proposal's own
    // profile (profile READ only) plus membership of the parent process.
    const collaborator = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });
    await testData.grantProfileAccess(
      proposal.profileId,
      collaborator.authUserId,
      collaborator.email,
      false,
    );

    const collaboratorCaller = await createAuthenticatedCaller(
      collaborator.email,
    );

    const result = await collaboratorCaller.decision.updateProposal({
      proposalId: proposal.id,
      data: { proposalData: { title: 'Edited by collaborator' } },
    });

    expect(result.proposalData).toMatchObject({
      title: 'Edited by collaborator',
    });
  });

  it('should allow a decision admin to update the proposal data', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instance;

    const author = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });

    const proposal = await testData.createProposal({
      userEmail: author.email,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Admin Reviewed Proposal' },
    });

    const adminCaller = await createAuthenticatedCaller(setup.userEmail);

    const result = await adminCaller.decision.updateProposal({
      proposalId: proposal.id,
      data: { proposalData: { title: 'Edited by admin' } },
    });

    expect(result.proposalData).toMatchObject({ title: 'Edited by admin' });
  });

  it('should not allow another process member to update the proposal data', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instance;

    const author = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });

    const proposal = await testData.createProposal({
      userEmail: author.email,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Original Title' },
    });

    // A second member of the same process: no grant on the proposal profile,
    // no admin rights on the decision.
    const otherMember = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });

    const otherMemberCaller = await createAuthenticatedCaller(
      otherMember.email,
    );

    await expect(
      otherMemberCaller.decision.updateProposal({
        proposalId: proposal.id,
        data: { proposalData: { title: 'Hijacked Title' } },
      }),
    ).rejects.toMatchObject({
      cause: { statusCode: 403 },
    });
  });

  it('should not allow another process member to update a draft they did not author', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instance;

    const author = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });

    // Proposals are created in DRAFT status by default.
    const draft = await testData.createProposal({
      userEmail: author.email,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Private Draft' },
    });

    const otherMember = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });

    const otherMemberCaller = await createAuthenticatedCaller(
      otherMember.email,
    );

    await expect(
      otherMemberCaller.decision.updateProposal({
        proposalId: draft.id,
        data: { proposalData: { title: 'Hijacked Draft' } },
      }),
    ).rejects.toMatchObject({
      cause: { statusCode: 403 },
    });
  });
});

describeDecisionAccessTierGating('updateProposal', {
  noJwtNonPublic: accessTierGatingCell(
    'rejects no-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);

      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instance;
      const proposal = await testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'no-JWT should not reach this' },
      });

      const caller = await callers.noJwt();

      await expectFailsAccessTierGate(
        caller.decision.updateProposal({
          proposalId: proposal.id,
          data: { visibility: Visibility.HIDDEN },
        }),
        'none',
      );
    },
  ),

  anonJwtNonPublic: accessTierGatingCell(
    'admits anon-JWT caller past the tier gate',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);

      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instance;
      const proposal = await testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'anon should bounce' },
      });

      const caller = await callers.anonJwt();

      await expectPassesAccessTierGate(
        caller.decision.updateProposal({
          proposalId: proposal.id,
          data: { visibility: Visibility.HIDDEN },
        }),
      );
    },
  ),

  userJwtNonPublic: accessTierGatingCell(
    'admits user-JWT caller past the tier gate',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);

      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instance;
      const proposal = await testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'anon should bounce' },
      });

      const caller = await callers.userJwt();

      await expectPassesAccessTierGate(
        caller.decision.updateProposal({
          proposalId: proposal.id,
          data: { visibility: Visibility.HIDDEN },
        }),
      );
    },
  ),

  networkJwtNonPublic: accessTierGatingCell(
    'admits network-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);

      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instance;
      const proposal = await testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'Common-JWT owner updates' },
      });

      const caller = await callers.networkJwt(setup.userEmail);

      const result = await caller.decision.updateProposal({
        proposalId: proposal.id,
        data: { visibility: Visibility.HIDDEN },
      });

      expect(result.visibility).toBe(Visibility.HIDDEN);
    },
  ),
});
