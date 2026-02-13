import { mockCollab } from '@op/collab/testing';
import { db } from '@op/db/client';
import { Visibility, proposals } from '@op/db/schema';
import { eq } from 'drizzle-orm';
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
      budget: { value: 5000, currency: 'USD' },
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
