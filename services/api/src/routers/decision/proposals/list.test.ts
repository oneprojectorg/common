import { mockCollab, textFragment } from '@op/collab/testing';
import { PROPOSAL_SEARCH_MAX_LENGTH } from '@op/common/client';
import { db } from '@op/db/client';
import {
  ProcessStatus,
  ProposalStatus,
  Visibility,
  decisionProcesses,
  processInstances,
  profileUserToAccessRoles,
  profileUsers,
  proposals,
  stateTransitionHistory,
} from '@op/db/schema';
import { ROLES } from '@op/db/seedData/accessControl';
import { createReviewAssignment } from '@op/test';
import { and, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { appRouter } from '../..';
import { transformFormDataToProcessSchema as cowopSchema } from '../../../../../../apps/app/src/components/Profile/CreateDecisionProcessModal/schemas/cowop';
import { TestDecisionsDataManager } from '../../../test/helpers/TestDecisionsDataManager';
import {
  accessTierGatingCell,
  describeDecisionAccessTierGating,
  expectPassesAccessTierGate,
} from '../../../test/helpers/gating/decision';
import {
  schemaWithPipeline,
  schemaWithThreePhases,
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

    const instance = setup.instance;

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

    const instance = setup.instance;

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

    const instance = setup.instance;

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

    const instance = setup.instance;

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

    const instance = setup.instance;

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

    const instance = setup.instance;

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

  it('should hide rejected proposals from non-admin users', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instance;

    const [keptProposal, rejectedProposal, adminCaller, memberUser] =
      await Promise.all([
        testData.createProposal({
          userEmail: setup.userEmail,
          processInstanceId: instance.instance.id,
          proposalData: { title: 'Kept Proposal' },
        }),
        testData.createProposal({
          userEmail: setup.userEmail,
          processInstanceId: instance.instance.id,
          proposalData: { title: 'Rejected Proposal' },
        }),
        createAuthenticatedCaller(setup.userEmail),
        testData.createMemberUser({
          organization: setup.organization,
          instanceProfileIds: [instance.profileId],
        }),
      ]);

    // A draft can't be rejected, so submit both first.
    await Promise.all([
      adminCaller.decision.submitProposal({ proposalId: keptProposal.id }),
      adminCaller.decision.submitProposal({ proposalId: rejectedProposal.id }),
    ]);

    await adminCaller.decision.rejectProposal({
      proposalId: rejectedProposal.id,
    });

    const memberCaller = await createAuthenticatedCaller(memberUser.email);
    const result = await memberCaller.decision.listProposals({
      processInstanceId: instance.instance.id,
    });

    // Non-admin sees only the non-rejected proposal, exactly like a flagged one.
    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0]?.id).toBe(keptProposal.id);
  });

  it('should show rejected proposals to admin users', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instance;

    const memberUser = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });

    const [keptProposal, rejectedProposal, adminCaller] = await Promise.all([
      testData.createProposal({
        userEmail: memberUser.email,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'Kept Proposal' },
      }),
      testData.createProposal({
        userEmail: memberUser.email,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'Rejected Proposal' },
      }),
      createAuthenticatedCaller(setup.userEmail),
    ]);

    const memberCaller = await createAuthenticatedCaller(memberUser.email);
    await Promise.all([
      memberCaller.decision.submitProposal({ proposalId: keptProposal.id }),
      memberCaller.decision.submitProposal({ proposalId: rejectedProposal.id }),
    ]);

    await adminCaller.decision.rejectProposal({
      proposalId: rejectedProposal.id,
    });

    const result = await adminCaller.decision.listProposals({
      processInstanceId: instance.instance.id,
    });

    // Admin still sees the rejected proposal in the proposal list, carrying its
    // REJECTED status, the same way an admin sees flagged proposals.
    expect(result.proposals).toHaveLength(2);
    const rejected = result.proposals.find((p) => p.id === rejectedProposal.id);
    expect(rejected?.status).toBe(ProposalStatus.REJECTED);
  });

  it('restores a rejected proposal to the active pool on undo', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instance;

    const [proposal, adminCaller, memberUser] = await Promise.all([
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'Proposal' },
      }),
      createAuthenticatedCaller(setup.userEmail),
      testData.createMemberUser({
        organization: setup.organization,
        instanceProfileIds: [instance.profileId],
      }),
    ]);

    await adminCaller.decision.submitProposal({ proposalId: proposal.id });
    await adminCaller.decision.rejectProposal({ proposalId: proposal.id });
    await adminCaller.decision.unrejectProposal({ proposalId: proposal.id });

    // Back to SUBMITTED, so a non-admin sees it in the list again.
    const memberCaller = await createAuthenticatedCaller(memberUser.email);
    const result = await memberCaller.decision.listProposals({
      processInstanceId: instance.instance.id,
    });

    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0]?.id).toBe(proposal.id);
    expect(result.proposals[0]?.status).toBe(ProposalStatus.SUBMITTED);
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

    const instance = setup.instance;

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

  it('should show hidden proposals to invited collaborators on the proposal profile', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instance;

    const [submitter, collaborator, adminCaller] = await Promise.all([
      testData.createMemberUser({
        organization: setup.organization,
        instanceProfileIds: [instance.profileId],
      }),
      testData.createMemberUser({
        organization: setup.organization,
        instanceProfileIds: [instance.profileId],
      }),
      createAuthenticatedCaller(setup.userEmail),
    ]);

    const proposal = await testData.createProposal({
      userEmail: submitter.email,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Co-authored Hidden Proposal' },
    });

    // Add the collaborator as a profileUser on the proposal's profile —
    // mirrors what acceptProposalInvite does in production.
    const [collaboratorProfileUser] = await db
      .insert(profileUsers)
      .values({
        profileId: proposal.profileId,
        authUserId: collaborator.authUserId,
        email: collaborator.email,
      })
      .returning();

    if (!collaboratorProfileUser) {
      throw new Error('Failed to create collaborator profileUser');
    }

    await db.insert(profileUserToAccessRoles).values({
      profileUserId: collaboratorProfileUser.id,
      accessRoleId: ROLES.MEMBER.id,
    });

    // Submit the proposal so it transitions out of DRAFT — the hidden-
    // visibility filter only applies to non-draft proposals; drafts have
    // their own collaborator-aware filter path.
    const submitterCaller = await createAuthenticatedCaller(submitter.email);
    await submitterCaller.decision.submitProposal({ proposalId: proposal.id });

    // Admin hides the now-submitted proposal
    await adminCaller.decision.updateProposal({
      proposalId: proposal.id,
      data: { visibility: Visibility.HIDDEN },
    });

    // Collaborator (not the submitter, not an admin) should still see the
    // hidden proposal in the list.
    const collaboratorCaller = await createAuthenticatedCaller(
      collaborator.email,
    );
    const result = await collaboratorCaller.decision.listProposals({
      processInstanceId: instance.instance.id,
    });

    expect(result.proposals).toHaveLength(1);
    expect(result.proposals[0]?.id).toBe(proposal.id);
    expect(result.proposals[0]?.visibility).toBe(Visibility.HIDDEN);
  });

  it('should support cursor pagination with limit and next', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instance;

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
    });

    expect(page1.proposals).toHaveLength(2);
    expect(page1.total).toBe(3);
    expect(page1.hasMore).toBe(true);
    expect(page1.next).not.toBeNull();

    // Second page, following the cursor
    const page2 = await caller.decision.listProposals({
      processInstanceId: instance.instance.id,
      limit: 2,
      cursor: page1.next,
    });

    expect(page2.proposals).toHaveLength(1);
    expect(page2.total).toBe(3);
    expect(page2.hasMore).toBe(false);
    expect(page2.next).toBeNull();

    // Pages must not overlap.
    const page1Ids = page1.proposals.map((p) => p.id);
    expect(page1Ids).not.toContain(page2.proposals[0]?.id);
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

    const instance = setup.instance;

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

    const instance = setup.instance;

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

    const instance = setup.instance;

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

  it('should return a plain-text previewText for legacy proposals with description', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instance;

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
    expect(foundProposal?.previewText).toBe('This is rich content');
    // List rows ship the precomputed preview instead of the full content.
    expect(foundProposal?.documentContent).toBeUndefined();
  });

  it('should return previewText from TipTap content when collaborationDocId exists', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instance;

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
    expect(foundProposal?.previewText).toBe('Hello from TipTap');
    expect(foundProposal?.documentContent).toBeUndefined();
  });

  it('should omit previewText when a TipTap fetch fails so one bad doc does not break the list', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instance;

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

    // A single unavailable document must not break the whole list: the list
    // still resolves and the affected proposal's previewText is undefined.
    const result = await caller.decision.listProposals({
      processInstanceId: instance.instance.id,
    });

    const foundProposal = result.proposals.find((p) => p.id === proposal.id);
    expect(foundProposal).toBeDefined();
    expect(foundProposal?.previewText).toBeUndefined();
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

    const instance = setup.instance;

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

    expect(found1?.previewText).toBe('Doc 1');
    expect(found2?.previewText).toBe('Doc 2');
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

    const instance = setup.instance;

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

    expect(foundCollab?.previewText).toBe('TipTap');
    expect(foundLegacy?.previewText).toBe('HTML');
    // Empty doc (e.g. unedited draft) — empty preview, not an error.
    expect(foundEmpty?.previewText).toBe('');
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

    const instance = setup.instance;

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
    expect(foundA?.previewText).toBe('body from content field');

    // Canonical budget passes through unchanged
    expect(foundB?.proposalData).toMatchObject({
      title: 'Legacy B',
      budget: { amount: 4200, currency: 'EUR' },
      category: ['Education'],
    });
    expect(foundB?.previewText).toBe('already migrated');
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

    const instance = setup.instance;

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
    expect(foundNew?.previewText).toBe('TipTap');

    // Legacy: budget normalized, content→description, custom field preserved
    expect(foundLegacy?.proposalData).toMatchObject({
      title: 'Legacy',
      description: '<p>old content field</p>',
      budget: { amount: 9999, currency: 'USD' },
      customField: 'should survive',
    });
    expect(foundLegacy?.previewText).toBe('old content field');
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

    const instance = setup.instance;

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

    const instance = setup.instance;

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

    const instance = setup.instance;

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

    const instance = setup.instance;

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

    const instance = setup.instance;

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

    const instance = setup.instance;

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

    const instance = setup.instance;

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

    const instance = setup.instance;

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

    // The pinned version's fragments drive both the preview and the resolved
    // system fields — the live (latest) fragments must not leak into the list.
    expect(listedProposal!.previewText).toBe('Pinned summary');
    expect(listedProposal!.proposalData).toMatchObject({
      title: 'Pinned Title',
      budget: { amount: 500, currency: 'EUR' },
    });
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
    const instanceId = setup.instance.instance.id;
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
    const instanceId = setup.instance.instance.id;
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
    const instanceId = setup.instance.instance.id;
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
    const instanceId = setup.instance.instance.id;
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
    const instanceId = setup.instance.instance.id;
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
    const instanceId = setup.instance.instance.id;
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
    const instanceId = setup.instance.instance.id;
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
    const instance = setup.instance;

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
    const instance = setup.instance;

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
    const instanceId = setup.instance.instance.id;
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

  it('hides a draft created mid-phase from views of earlier and later phases (strict bounded window)', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      processSchema: schemaWithThreePhases,
      instanceCount: 1,
      status: ProcessStatus.PUBLISHED,
    });
    const instanceId = setup.instance.instance.id;
    const { userEmail } = setup;
    const caller = await createAuthenticatedCaller(userEmail);

    // Advance into the middle phase so the draft is created strictly after
    // review's inbound transition (not at the boundary).
    await testData.advancePhase({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'review',
    });

    const draft = await testData.createProposal({
      userEmail,
      processInstanceId: instanceId,
      proposalData: { title: `Mid-phase draft ${task.id}` },
    });

    // Visible from the current (review) phase view.
    const reviewWhileCurrent = await caller.decision.listProposals({
      processInstanceId: instanceId,
      phaseId: 'review',
    });
    expect(reviewWhileCurrent.proposals.map((p) => p.id)).toContain(draft.id);

    // Advance past review so it now has both inbound and outbound transitions —
    // the draft sits strictly inside review's bounded window.
    await testData.advancePhase({
      instanceId,
      fromPhaseId: 'review',
      toPhaseId: 'final',
    });

    const submissionResult = await caller.decision.listProposals({
      processInstanceId: instanceId,
      phaseId: 'submission',
    });
    expect(submissionResult.proposals.map((p) => p.id)).not.toContain(draft.id);

    const finalResult = await caller.decision.listProposals({
      processInstanceId: instanceId,
      phaseId: 'final',
    });
    expect(finalResult.proposals.map((p) => p.id)).not.toContain(draft.id);

    const reviewResult = await caller.decision.listProposals({
      processInstanceId: instanceId,
      phaseId: 'review',
    });
    expect(reviewResult.proposals.map((p) => p.id)).toContain(draft.id);
  });

  it('hides a HIDDEN proposal from a non-admin viewing a later phase (visibility + phaseId)', async ({
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
    const instance = setup.instance;
    const instanceId = instance.instance.id;

    // Non-admin member with instance-level access but no proposal-level access.
    const member = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });

    const adminCaller = await createAuthenticatedCaller(setup.userEmail);

    // Admin creates and submits two proposals in the submission phase.
    const [visibleProposal, hiddenProposal] = await Promise.all([
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `Visible ${task.id}` },
      }),
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `Hidden ${task.id}` },
      }),
    ]);

    await Promise.all([
      adminCaller.decision.submitProposal({ proposalId: visibleProposal.id }),
      adminCaller.decision.submitProposal({ proposalId: hiddenProposal.id }),
    ]);

    // Hide one, then advance the instance so both submitted proposals are
    // carried into the review phase (no pipeline → nothing is dropped).
    await adminCaller.decision.updateProposal({
      proposalId: hiddenProposal.id,
      data: { visibility: Visibility.HIDDEN },
    });

    await testData.advancePhase({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'review',
    });

    // The HIDDEN filter must still apply when the query runs through the
    // phase-scoped path: the non-admin sees the visible proposal but not the
    // hidden one, even though both are in the review phase's scope.
    const memberCaller = await createAuthenticatedCaller(member.email);
    const result = await memberCaller.decision.listProposals({
      processInstanceId: instanceId,
      phaseId: 'review',
    });

    const ids = result.proposals.map((p) => p.id);
    expect(ids).toContain(visibleProposal.id);
    expect(ids).not.toContain(hiddenProposal.id);
  });

  it('orders proposals deterministically when createdAt values tie', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setup.instance;

    const [p1, p2, p3, caller] = await Promise.all([
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'A', description: 'A' },
      }),
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'B', description: 'B' },
      }),
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'C', description: 'C' },
      }),
      createAuthenticatedCaller(setup.userEmail),
    ]);

    // Force identical createdAt so the primary sort key alone can't order
    // them — the query needs a tie-breaker for asc/desc to differ.
    const sharedTimestamp = '2026-01-01T00:00:00.000Z';
    await db
      .update(proposals)
      .set({ createdAt: sharedTimestamp })
      .where(eq(proposals.processInstanceId, instance.instance.id));

    const desc = await caller.decision.listProposals({
      processInstanceId: instance.instance.id,
      dir: 'desc',
    });
    const asc = await caller.decision.listProposals({
      processInstanceId: instance.instance.id,
      dir: 'asc',
    });

    const descIds = desc.proposals.map((p) => p.id);
    const ascIds = asc.proposals.map((p) => p.id);

    expect([...descIds].sort()).toEqual([p1.id, p2.id, p3.id].sort());
    expect(ascIds).toEqual([...descIds].reverse());
  });
});

describeDecisionAccessTierGating('listProposals', {
  noJwtNonPublic: accessTierGatingCell(
    'admits no-JWT caller past the tier gate',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instance;

      const caller = await callers.noJwt();

      await expectPassesAccessTierGate(
        caller.decision.listProposals({
          processInstanceId: instance.instance.id,
        }),
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

      const caller = await callers.anonJwt();

      await expectPassesAccessTierGate(
        caller.decision.listProposals({
          processInstanceId: instance.instance.id,
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

      const caller = await callers.userJwt();

      await expectPassesAccessTierGate(
        caller.decision.listProposals({
          processInstanceId: instance.instance.id,
        }),
      );
    },
  ),

  networkJwtNonPublic: accessTierGatingCell(
    'admits network-JWT caller past the tier gate',
    async ({ task, onTestFinished, callers }) => {
      const testData = new TestDecisionsDataManager(task.id, onTestFinished);
      const setup = await testData.createDecisionSetup({
        instanceCount: 1,
        grantAccess: true,
      });
      const instance = setup.instance;

      const caller = await callers.networkJwt(setup.userEmail);

      await expectPassesAccessTierGate(
        caller.decision.listProposals({
          processInstanceId: instance.instance.id,
        }),
      );
    },
  ),
});

/**
 * `excludeAssignedForReview` — powers the reviewer's "Other proposals" tab by
 * hiding proposals the caller is assigned to review in the viewed phase. The
 * exclusion is resolved server-side from the caller's profile via a phase-
 * scoped `NOT EXISTS` anti-join, so `total` and keyset pagination reflect it.
 */
describe.concurrent('listProposals: excludeAssignedForReview', () => {
  /** Resolves the caller's current profile id (what the service excludes on). */
  async function getProfileId(authUserId: string): Promise<string> {
    const row = await db.query.users.findFirst({
      where: { authUserId },
      columns: { profileId: true },
    });
    if (!row?.profileId) {
      throw new Error(`No profile for auth user ${authUserId}`);
    }
    return row.profileId;
  }

  /**
   * Creates a PUBLISHED, no-pipeline instance with three SUBMITTED proposals
   * and advances it to the `review` phase (where all three stay visible).
   */
  async function setupReviewPhaseWithProposals(
    testData: TestDecisionsDataManager,
    task: { id: string },
  ) {
    const setup = await testData.createDecisionSetup({
      processSchema: schemaWithoutPipeline,
      instanceCount: 1,
      status: ProcessStatus.PUBLISHED,
      grantAccess: true,
    });
    const instanceId = setup.instance.instance.id;
    const { userEmail } = setup;

    const [p1, p2, p3] = await Promise.all([
      testData.createProposal({
        userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `Proposal 1 ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      }),
      testData.createProposal({
        userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `Proposal 2 ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      }),
      testData.createProposal({
        userEmail,
        processInstanceId: instanceId,
        proposalData: { title: `Proposal 3 ${task.id}` },
        status: ProposalStatus.SUBMITTED,
      }),
    ]);

    await testData.advancePhase({
      instanceId,
      fromPhaseId: 'submission',
      toPhaseId: 'review',
    });

    return { setup, instanceId, userEmail, p1, p2, p3 };
  }

  it('excludes the caller-assigned proposal and reflects it in total', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, userEmail, p1 } =
      await setupReviewPhaseWithProposals(testData, task);

    const callerProfileId = await getProfileId(setup.user.id);

    // Assign the caller to review p1 in the current (review) phase.
    await createReviewAssignment({
      processInstanceId: instanceId,
      proposalId: p1.id,
      reviewerProfileId: callerProfileId,
      phaseId: 'review',
    });

    const caller = await createAuthenticatedCaller(userEmail);

    // Flag off: all three proposals, including the assigned one.
    const withAssigned = await caller.decision.listProposals({
      processInstanceId: instanceId,
    });
    expect(withAssigned.total).toBe(3);
    expect(withAssigned.proposals.map((p) => p.id)).toContain(p1.id);

    // Flag on: the assigned proposal is gone and total drops to match.
    const withoutAssigned = await caller.decision.listProposals({
      processInstanceId: instanceId,
      excludeAssignedForReview: true,
    });
    expect(withoutAssigned.total).toBe(2);
    expect(withoutAssigned.proposals.map((p) => p.id)).not.toContain(p1.id);
  });

  it('keeps total and keyset pagination consistent with the exclusion', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, userEmail, p1, p2, p3 } =
      await setupReviewPhaseWithProposals(testData, task);

    const callerProfileId = await getProfileId(setup.user.id);
    await createReviewAssignment({
      processInstanceId: instanceId,
      proposalId: p1.id,
      reviewerProfileId: callerProfileId,
      phaseId: 'review',
    });

    const caller = await createAuthenticatedCaller(userEmail);

    // Page through the excluded list one row at a time.
    const page1 = await caller.decision.listProposals({
      processInstanceId: instanceId,
      excludeAssignedForReview: true,
      limit: 1,
    });
    expect(page1.total).toBe(2);
    expect(page1.hasMore).toBe(true);
    expect(page1.next).not.toBeNull();

    const page2 = await caller.decision.listProposals({
      processInstanceId: instanceId,
      excludeAssignedForReview: true,
      limit: 1,
      cursor: page1.next,
    });
    expect(page2.total).toBe(2);
    expect(page2.hasMore).toBe(false);

    // The assigned proposal never surfaces on any page; the other two do.
    const seenIds = [...page1.proposals, ...page2.proposals].map((p) => p.id);
    expect(seenIds).not.toContain(p1.id);
    expect(seenIds).toEqual(expect.arrayContaining([p2.id, p3.id]));
  });

  it('only excludes the current caller — a peer reviewer still sees everything', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, p1 } = await setupReviewPhaseWithProposals(
      testData,
      task,
    );

    // Assign p1 to a *different* reviewer.
    const peer = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [setup.instance.profileId],
    });
    await createReviewAssignment({
      processInstanceId: instanceId,
      proposalId: p1.id,
      reviewerProfileId: peer.profileId,
      phaseId: 'review',
    });

    // The caller (owner, no assignments of their own) sees all three even with
    // the flag on — the exclusion is scoped to the requester's assignments.
    const caller = await createAuthenticatedCaller(setup.userEmail);
    const result = await caller.decision.listProposals({
      processInstanceId: instanceId,
      excludeAssignedForReview: true,
    });
    expect(result.total).toBe(3);
    expect(result.proposals.map((p) => p.id)).toContain(p1.id);
  });

  it('does not exclude assignments from a different phase', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, userEmail, p1 } =
      await setupReviewPhaseWithProposals(testData, task);

    const callerProfileId = await getProfileId(setup.user.id);

    // Assignment lives in the *submission* phase, but we're viewing review.
    await createReviewAssignment({
      processInstanceId: instanceId,
      proposalId: p1.id,
      reviewerProfileId: callerProfileId,
      phaseId: 'submission',
    });

    const caller = await createAuthenticatedCaller(userEmail);
    const result = await caller.decision.listProposals({
      processInstanceId: instanceId,
      excludeAssignedForReview: true,
    });

    // The past-phase assignment must not hide the proposal in the current one.
    expect(result.total).toBe(3);
    expect(result.proposals.map((p) => p.id)).toContain(p1.id);
  });

  it('composes with sort direction, excluding the assigned proposal', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { setup, instanceId, userEmail, p1, p2, p3 } =
      await setupReviewPhaseWithProposals(testData, task);

    const callerProfileId = await getProfileId(setup.user.id);
    await createReviewAssignment({
      processInstanceId: instanceId,
      proposalId: p1.id,
      reviewerProfileId: callerProfileId,
      phaseId: 'review',
    });

    const caller = await createAuthenticatedCaller(userEmail);

    // Canonical ascending order with the flag off (creation order via
    // Promise.all isn't deterministic, so derive the expected order instead of
    // hard-coding it).
    const baseline = await caller.decision.listProposals({
      processInstanceId: instanceId,
      dir: 'asc',
    });
    const excluded = await caller.decision.listProposals({
      processInstanceId: instanceId,
      excludeAssignedForReview: true,
      dir: 'asc',
    });

    // The excluded list is exactly the baseline order minus the assigned p1 —
    // sort composes with the exclusion, order is otherwise preserved.
    const expectedIds = baseline.proposals
      .map((p) => p.id)
      .filter((id) => id !== p1.id);
    expect(excluded.proposals.map((p) => p.id)).toEqual(expectedIds);
    expect(expectedIds).toEqual(expect.arrayContaining([p2.id, p3.id]));
  });
});

describe.concurrent('listProposals: search', () => {
  /** Two proposals with distinct titles, on their own instance. */
  async function setupTitledProposals(
    testData: TestDecisionsDataManager,
    titles: [string, string],
  ) {
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instanceId = setup.instance.instance.id;

    const [first, second, caller] = await Promise.all([
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instanceId,
        proposalData: { title: titles[0] },
        status: ProposalStatus.SUBMITTED,
      }),
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instanceId,
        proposalData: { title: titles[1] },
        status: ProposalStatus.SUBMITTED,
      }),
      createAuthenticatedCaller(setup.userEmail),
    ]);

    return { setup, instanceId, caller, first, second };
  }

  it('matches titles case-insensitively and reflects the filter in total', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, caller, first, second } = await setupTitledProposals(
      testData,
      ['Bike Lanes on Fifth', 'Community Garden'],
    );

    const result = await caller.decision.listProposals({
      processInstanceId: instanceId,
      search: 'bIkE',
    });

    expect(result.proposals.map((p) => p.id)).toEqual([first.id]);
    // `total` counts the filtered set, not the whole pool.
    expect(result.total).toBe(1);
    expect(result.proposals.map((p) => p.id)).not.toContain(second.id);
  });

  it('matches words in any order, and requires all of them', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, caller, first } = await setupTitledProposals(testData, [
      'Riverside Bike Path',
      'Downtown Mural',
    ]);

    // Reversed word order still finds it — a single substring match would not,
    // since "path riverside" never appears in the title.
    const reversed = await caller.decision.listProposals({
      processInstanceId: instanceId,
      search: 'path riverside',
    });
    expect(reversed.proposals.map((p) => p.id)).toEqual([first.id]);

    // Words are ANDed, so a term drawn from two different titles matches neither.
    const mixed = await caller.decision.listProposals({
      processInstanceId: instanceId,
      search: 'bike mural',
    });
    expect(mixed.proposals).toHaveLength(0);
    expect(mixed.total).toBe(0);
  });

  it('treats LIKE wildcards in the query as literal characters', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, caller } = await setupTitledProposals(testData, [
      'Alpha Project',
      'Beta Project',
    ]);

    // Unescaped, `%` and `_` are both wildcards that match every title.
    for (const search of ['%', '_', 'Alpha%Project']) {
      const result = await caller.decision.listProposals({
        processInstanceId: instanceId,
        search,
      });
      expect(result.proposals).toHaveLength(0);
      expect(result.total).toBe(0);
    }
  });

  it('finds a proposal by its current title after a rename', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instanceId = setup.instance.instance.id;

    const [proposal, caller] = await Promise.all([
      testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instanceId,
        proposalData: { title: 'Placeholder Draft' },
      }),
      createAuthenticatedCaller(setup.userEmail),
    ]);

    // Autosave sends `title` alongside `proposalData` but never rewrites
    // `proposalData.title`, so the row's JSON keeps the creation-time value.
    await caller.decision.updateProposal({
      proposalId: proposal.id,
      data: { title: 'Bicycle Parking Expansion' },
    });

    const byNewTitle = await caller.decision.listProposals({
      processInstanceId: instanceId,
      search: 'Bicycle Parking',
    });
    expect(byNewTitle.proposals.map((p) => p.id)).toEqual([proposal.id]);

    const byStaleTitle = await caller.decision.listProposals({
      processInstanceId: instanceId,
      search: 'Placeholder',
    });
    expect(byStaleTitle.proposals).toHaveLength(0);
  });

  it('ignores an empty or whitespace-only query', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, caller } = await setupTitledProposals(testData, [
      'Alpha Project',
      'Beta Project',
    ]);

    for (const search of ['', '   ']) {
      const result = await caller.decision.listProposals({
        processInstanceId: instanceId,
        search,
      });
      expect(result.total).toBe(2);
    }
  });

  it('drops words past the cap, widening the match rather than rejecting', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    // Exactly the 10 words the cap allows.
    const tenWords = 'one two three four five six seven eight nine ten';
    const { instanceId, caller, first } = await setupTitledProposals(testData, [
      tenWords,
      'Downtown Mural',
    ]);

    // The 11th word matches nothing but is dropped before it becomes a
    // predicate, so the proposal still comes back.
    const overCap = await caller.decision.listProposals({
      processInstanceId: instanceId,
      search: `${tenWords} zzzznomatch`,
    });
    expect(overCap.proposals.map((p) => p.id)).toEqual([first.id]);

    // Inside the cap the same word does filter — so it was the cap, not the
    // word being ignored generally.
    const underCap = await caller.decision.listProposals({
      processInstanceId: instanceId,
      search: 'one zzzznomatch',
    });
    expect(underCap.proposals).toHaveLength(0);
  });

  it('truncates an over-long query instead of rejecting it', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, caller, first } = await setupTitledProposals(testData, [
      'Bike Lanes on Fifth',
      'Community Garden',
    ]);

    // The non-matching word sits entirely past the cap: truncation drops it
    // and the title still matches, rejection would throw.
    const overCap =
      `Bike`.padEnd(PROPOSAL_SEARCH_MAX_LENGTH, ' ') + 'zzzznomatch';
    expect(overCap.length).toBeGreaterThan(PROPOSAL_SEARCH_MAX_LENGTH);

    const result = await caller.decision.listProposals({
      processInstanceId: instanceId,
      search: overCap,
    });
    expect(result.proposals.map((p) => p.id)).toEqual([first.id]);

    // Inside the cap the same word does filter — so it was the truncation.
    const withinCap = await caller.decision.listProposals({
      processInstanceId: instanceId,
      search: 'Bike zzzznomatch',
    });
    expect(withinCap.proposals).toHaveLength(0);
  });
});

describe.concurrent('listProposals: similarToProposalId', () => {
  /** Titled proposals on their own instance; the first is the merge source. */
  async function setupSuggestionProposals(
    testData: TestDecisionsDataManager,
    titles: string[],
  ) {
    const setup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const instanceId = setup.instance.instance.id;

    const [caller, ...created] = await Promise.all([
      createAuthenticatedCaller(setup.userEmail),
      ...titles.map((title) =>
        testData.createProposal({
          userEmail: setup.userEmail,
          processInstanceId: instanceId,
          proposalData: { title },
          status: ProposalStatus.SUBMITTED,
        }),
      ),
    ]);

    return { instanceId, caller, proposals: created };
  }

  it('ranks by shared title words and drops the source from its own results', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const {
      instanceId,
      caller,
      proposals: [source, twoWords, oneWord, unrelated],
    } = await setupSuggestionProposals(testData, [
      'Riverside Bike Lanes',
      'Riverside Bike Parking',
      'Downtown Bike Repair',
      'Community Garden Beds',
    ]);

    const result = await caller.decision.listProposals({
      processInstanceId: instanceId,
      similarToProposalId: source!.id,
    });

    // Two shared words beats one; sharing none is filtered out entirely, so
    // "top N" means the N best of the proposals that actually relate.
    expect(result.proposals.map((p) => p.id)).toEqual([
      twoWords!.id,
      oneWord!.id,
    ]);
    expect(result.proposals.map((p) => p.id)).not.toContain(source!.id);
    expect(result.proposals.map((p) => p.id)).not.toContain(unrelated!.id);
    // `total` counts the same filtered set the page came from.
    expect(result.total).toBe(2);
    // Ranking by a computed score can't keyset, so it stays a single page.
    expect(result.next).toBeNull();
  });

  it('matches a word inside a longer one, like the search box does', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const {
      instanceId,
      caller,
      proposals: [source, plural],
    } = await setupSuggestionProposals(testData, [
      'Community Garden Revamp',
      'Community Gardens',
    ]);

    // `ILIKE '%garden%'` is what makes "Gardens" reachable from "Garden" — a
    // full-text match from word starts would score this pair on "Community"
    // alone.
    const result = await caller.decision.listProposals({
      processInstanceId: instanceId,
      similarToProposalId: source!.id,
    });

    expect(result.proposals.map((p) => p.id)).toEqual([plural!.id]);
  });

  it('ignores words too short to carry signal', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const {
      instanceId,
      caller,
      proposals: [source],
    } = await setupSuggestionProposals(testData, [
      'Go To A Park',
      'Repair the Pier',
    ]);

    // Every word of the source under three characters is dropped, so only
    // "Park" is searched — and nothing else mentions it. Without the length
    // floor, "a" would match "Repair" and suggest an unrelated proposal.
    const result = await caller.decision.listProposals({
      processInstanceId: instanceId,
      similarToProposalId: source!.id,
    });

    expect(result.proposals).toHaveLength(0);
  });

  it('falls back to the plain list when the source title has no usable words', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const {
      instanceId,
      caller,
      proposals: [source],
    } = await setupSuggestionProposals(testData, [
      'Go To It',
      'Riverside Bike Lanes',
      'Community Garden Beds',
    ]);

    // Nothing to search for, so the filter never applies — but the source is
    // still excluded, because offering a self-merge is never right.
    const result = await caller.decision.listProposals({
      processInstanceId: instanceId,
      similarToProposalId: source!.id,
    });

    expect(result.proposals).toHaveLength(2);
    expect(result.proposals.map((p) => p.id)).not.toContain(source!.id);
    expect(result.next).toBeNull();
  });

  it('ignores a proposal from another decision instead of searching its title', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const { instanceId, caller } = await setupSuggestionProposals(testData, [
      'Riverside Bike Lanes',
      'Community Garden Beds',
    ]);

    const otherSetup = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });
    const outsider = await testData.createProposal({
      userEmail: otherSetup.userEmail,
      processInstanceId: otherSetup.instance.instance.id,
      proposalData: { title: 'Riverside Bike Lanes' },
      status: ProposalStatus.SUBMITTED,
    });

    const result = await caller.decision.listProposals({
      processInstanceId: instanceId,
      similarToProposalId: outsider.id,
    });

    // Both proposals still listed — the out-of-scope id resolves to no words
    // rather than becoming a title-probe oracle for another decision.
    expect(result.proposals).toHaveLength(2);
  });

  it('treats LIKE wildcards in a source title as literal characters', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const {
      instanceId,
      caller,
      proposals: [source, literal],
    } = await setupSuggestionProposals(testData, [
      'Fund %%% Everything',
      'Rebuild %%% Bridge',
    ]);

    // Unescaped, `%%%` would match every title in the decision.
    const result = await caller.decision.listProposals({
      processInstanceId: instanceId,
      similarToProposalId: source!.id,
    });

    expect(result.proposals.map((p) => p.id)).toEqual([literal!.id]);
  });
});
