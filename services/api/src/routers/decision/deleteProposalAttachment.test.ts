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

describe.concurrent('deleteProposalAttachment', () => {
  it('should allow uploader to delete their own attachment', async ({
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

    // Upload an attachment
    const uploadResult = await caller.decision.uploadProposalAttachment({
      file: VALID_PNG_BASE64,
      fileName: 'to-delete.png',
      mimeType: 'image/png',
      proposalId: proposal.id,
    });

    // Verify it exists
    const linkBefore = await db.query.proposalAttachments.findFirst({
      where: {
        proposalId: proposal.id,
        attachmentId: uploadResult.id,
      },
    });
    expect(linkBefore).toBeDefined();

    // Delete it
    await caller.decision.deleteProposalAttachment({
      attachmentId: uploadResult.id,
      proposalId: proposal.id,
    });

    // Verify link is gone
    const linkAfter = await db.query.proposalAttachments.findFirst({
      where: {
        proposalId: proposal.id,
        attachmentId: uploadResult.id,
      },
    });
    expect(linkAfter).toBeUndefined();
  });

  it('should reject delete from user who did not upload the attachment', async ({
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

    const adminCaller = await createAuthenticatedCaller(setup.userEmail);

    // Admin uploads an attachment
    const uploadResult = await adminCaller.decision.uploadProposalAttachment({
      file: VALID_PNG_BASE64,
      fileName: 'admin-file.png',
      mimeType: 'image/png',
      proposalId: proposal.id,
    });

    // Create a member user in the same org
    const memberUser = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });

    const memberCaller = await createAuthenticatedCaller(memberUser.email);

    // Member should NOT be able to delete admin's attachment
    await expect(
      memberCaller.decision.deleteProposalAttachment({
        attachmentId: uploadResult.id,
        proposalId: proposal.id,
      }),
    ).rejects.toMatchObject({
      message: 'Not authorized to delete this attachment',
    });
  });
});
