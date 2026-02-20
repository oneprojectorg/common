import { db } from '@op/db/client';
import { describe, expect, it } from 'vitest';

import { appRouter } from '..';
import { TestDecisionsDataManager } from '../../test/helpers/TestDecisionsDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../test/supabase-utils';
import { createCallerFactory } from '../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

// Small valid PNG as base64 (1x1 pixel)
const VALID_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

describe.concurrent('uploadProposalAttachment', () => {
  it('should allow user with decisions:UPDATE permission to upload attachment to proposal', async ({
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

    const result = await caller.decision.uploadProposalAttachment({
      file: VALID_PNG_BASE64,
      fileName: 'test-image.png',
      mimeType: 'image/png',
      proposalId: proposal.id,
    });

    expect(result).toMatchObject({
      fileName: 'test-image.png',
      mimeType: 'image/png',
    });
    expect(result.id).toBeDefined();
    expect(result.fileSize).toBeGreaterThan(0);

    // Verify attachment was linked to proposal
    const link = await db.query.proposalAttachments.findFirst({
      where: {
        proposalId: proposal.id,
        attachmentId: result.id,
      },
    });
    expect(link).toBeDefined();
  });

  it('should allow non-owner member with proposal permissions to upload attachment', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    // Create setup for user A who owns the proposal
    const setupA = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setupA.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    const proposal = await testData.createProposal({
      callerEmail: setupA.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Test Proposal', description: 'A test' },
    });

    // Create a member user with access to the same instance (not the proposal owner)
    const member = await testData.createMemberUser({
      organization: setupA.organization,
      instanceProfileIds: [instance.profileId],
    });

    const memberCaller = await createAuthenticatedCaller(member.email);

    // Non-owner member WITH proposal permissions should be able to upload
    const result = await memberCaller.decision.uploadProposalAttachment({
      file: VALID_PNG_BASE64,
      fileName: 'member-upload.png',
      mimeType: 'image/png',
      proposalId: proposal.id,
    });

    expect(result).toMatchObject({
      fileName: 'member-upload.png',
      mimeType: 'image/png',
    });
    expect(result.id).toBeDefined();
    expect(result.fileSize).toBeGreaterThan(0);

    // Verify attachment was linked to proposal
    const link = await db.query.proposalAttachments.findFirst({
      where: {
        proposalId: proposal.id,
        attachmentId: result.id,
      },
    });
    expect(link).toBeDefined();
  });

  it('should reject upload from user without proposal permissions', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    // Create setup for user A who owns the proposal
    const setupA = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instanceA = setupA.instances[0];
    if (!instanceA) {
      throw new Error('No instance created');
    }

    const proposal = await testData.createProposal({
      callerEmail: setupA.userEmail,
      processInstanceId: instanceA.instance.id,
      proposalData: { title: 'Test Proposal', description: 'A test' },
    });

    // Create a different user with NO access to the instance
    const setupB = await testData.createDecisionSetup({
      instanceCount: 0,
      grantAccess: false,
    });

    const nonOwnerCaller = await createAuthenticatedCaller(setupB.userEmail);

    // User without proposal permissions should NOT be able to upload
    await expect(
      nonOwnerCaller.decision.uploadProposalAttachment({
        file: VALID_PNG_BASE64,
        fileName: 'malicious.png',
        mimeType: 'image/png',
        proposalId: proposal.id,
      }),
    ).rejects.toMatchObject({
      cause: { name: 'AccessControlException' },
    });
  });
});
