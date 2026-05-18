import { db } from '@op/db/client';
import { describe, expect, it } from 'vitest';

import { appRouter } from '..';
import { TestDecisionsDataManager } from '../../test/helpers/TestDecisionsDataManager';
import { uploadProposalAttachmentFixture } from '../../test/helpers/uploadProposalAttachmentFixture';
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

describe.concurrent('deleteProposalAttachment', () => {
  it('should allow proposal owner to delete attachment', async ({
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
      userEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Test Proposal', description: 'A test' },
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const uploadResult = await uploadProposalAttachmentFixture(caller, {
      proposalId: proposal.id,
      fileName: 'to-delete.png',
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

  it('should allow non-owner member with proposal permissions to delete attachment', async ({
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
      userEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Test Proposal', description: 'A test' },
    });

    const ownerCaller = await createAuthenticatedCaller(setup.userEmail);

    const uploadResult = await uploadProposalAttachmentFixture(ownerCaller, {
      proposalId: proposal.id,
      fileName: 'owner-file.png',
    });

    const linkBefore = await db.query.proposalAttachments.findFirst({
      where: {
        proposalId: proposal.id,
        attachmentId: uploadResult.id,
      },
    });
    expect(linkBefore).toBeDefined();

    // Create a user and grant them access to the proposal profile (simulating an invite)
    const member = await testData.createMemberUser({
      organization: setup.organization,
    });

    await testData.grantProfileAccess(
      proposal.profileId,
      member.authUserId,
      member.email,
    );

    const memberCaller = await createAuthenticatedCaller(member.email);

    // Non-owner member WITH proposal permissions should be able to delete
    await memberCaller.decision.deleteProposalAttachment({
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

  it('should reject delete from user without proposal permissions', async ({
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
      userEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Test Proposal', description: 'A test' },
    });

    const ownerCaller = await createAuthenticatedCaller(setup.userEmail);

    const uploadResult = await uploadProposalAttachmentFixture(ownerCaller, {
      proposalId: proposal.id,
      fileName: 'owner-file.png',
    });

    // Create a different user with NO access to the instance
    const otherSetup = await testData.createDecisionSetup({
      instanceCount: 0,
      grantAccess: false,
    });

    const nonOwnerCaller = await createAuthenticatedCaller(
      otherSetup.userEmail,
    );

    // User without proposal permissions should NOT be able to delete
    await expect(
      nonOwnerCaller.decision.deleteProposalAttachment({
        attachmentId: uploadResult.id,
        proposalId: proposal.id,
      }),
    ).rejects.toMatchObject({
      cause: { name: 'UnauthorizedError' },
    });
  });
});
