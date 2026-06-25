import { db } from '@op/db/client';
import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';

import { appRouter } from '..';
import { TestDecisionsDataManager } from '../../test/helpers/TestDecisionsDataManager';
import {
  accessTierGatingCell,
  describeAccessTierGating,
  expectFailsAccessTierGate,
  expectPassesAccessTierGate,
} from '../../test/helpers/gating';
import {
  createIsolatedSession,
  createTestContextWithSession,
  supabaseTestAdminClient,
} from '../../test/supabase-utils';
import { createCallerFactory } from '../../trpcFactory';

const createCaller = createCallerFactory(appRouter);

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

// Small valid PNG as base64 (1x1 pixel). We decode it once and PUT the
// raw bytes into Supabase storage in tests — same shape the production
// client uses via the signed upload URL.
const VALID_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const VALID_PNG_BUFFER = Buffer.from(VALID_PNG_BASE64, 'base64');

async function uploadTestObject(storagePath: string): Promise<void> {
  const { error } = await supabaseTestAdminClient.storage
    .from('assets')
    .upload(storagePath, VALID_PNG_BUFFER, {
      contentType: 'image/png',
      upsert: false,
    });
  if (error) {
    throw new Error(`Test setup: failed to upload object: ${error.message}`);
  }
}

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

    const instance = setup.instance;

    const proposal = await testData.createProposal({
      userEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Test Proposal', description: 'A test' },
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const signed = await caller.decision.signProposalAttachmentUploadUrl({
      proposalId: proposal.id,
      fileName: 'test-image.png',
    });
    await uploadTestObject(signed.storagePath);

    const result = await caller.decision.uploadProposalAttachment({
      storagePath: signed.storagePath,
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

    const instance = setupA.instance;

    const proposal = await testData.createProposal({
      userEmail: setupA.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Test Proposal', description: 'A test' },
    });

    // Create a user and grant them access to the proposal profile (simulating an invite)
    const member = await testData.createMemberUser({
      organization: setupA.organization,
    });

    await testData.grantProfileAccess(
      proposal.profileId,
      member.authUserId,
      member.email,
    );

    const memberCaller = await createAuthenticatedCaller(member.email);

    // Non-owner member WITH proposal permissions should be able to upload
    const signed = await memberCaller.decision.signProposalAttachmentUploadUrl({
      proposalId: proposal.id,
      fileName: 'member-upload.png',
    });
    await uploadTestObject(signed.storagePath);

    const result = await memberCaller.decision.uploadProposalAttachment({
      storagePath: signed.storagePath,
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

    const instanceA = setupA.instance;

    const proposal = await testData.createProposal({
      userEmail: setupA.userEmail,
      processInstanceId: instanceA.instance.id,
      proposalData: { title: 'Test Proposal', description: 'A test' },
    });

    // Create a different user with NO access to the instance
    const setupB = await testData.createDecisionSetup({
      instanceCount: 0,
      grantAccess: false,
    });

    const nonOwnerCaller = await createAuthenticatedCaller(setupB.userEmail);

    // Auth is checked before the storage lookup, so a fake storagePath is fine.
    await expect(
      nonOwnerCaller.decision.uploadProposalAttachment({
        storagePath:
          'profile/00000000-0000-0000-0000-000000000000/proposals/fake.png',
        fileName: 'malicious.png',
        mimeType: 'image/png',
        proposalId: proposal.id,
      }),
    ).rejects.toMatchObject({
      cause: { name: 'UnauthorizedError' },
    });
  });
});

describeAccessTierGating('uploadProposalAttachment', {
  noJwt: accessTierGatingCell(
    'rejects no-JWT caller',
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
        caller.decision.uploadProposalAttachment({
          storagePath:
            'profile/00000000-0000-0000-0000-000000000000/proposals/no-jwt.png',
          fileName: 'no-jwt.png',
          mimeType: 'image/png',
          proposalId: proposal.id,
        }),
        'none',
      );
    },
  ),

  anonJwt: accessTierGatingCell(
    'admits anon-JWT past the tier gate',
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
        proposalData: { title: 'anon gets past the gate' },
      });

      const caller = await callers.anonJwt();

      await expectPassesAccessTierGate(
        caller.decision.uploadProposalAttachment({
          storagePath:
            'profile/00000000-0000-0000-0000-000000000000/proposals/anon.png',
          fileName: 'anon.png',
          mimeType: 'image/png',
          proposalId: proposal.id,
        }),
      );
    },
  ),

  userJwt: accessTierGatingCell(
    'admits out-of-network user-JWT past the tier gate',
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
        proposalData: { title: 'out-of-network user gets past the gate' },
      });

      const caller = await callers.userJwt();

      await expectPassesAccessTierGate(
        caller.decision.uploadProposalAttachment({
          storagePath:
            'profile/00000000-0000-0000-0000-000000000000/proposals/user.png',
          fileName: 'user.png',
          mimeType: 'image/png',
          proposalId: proposal.id,
        }),
      );
    },
  ),

  networkJwt: accessTierGatingCell(
    'admits network-JWT caller',
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
        proposalData: { title: 'Common-JWT owner uploads' },
      });

      const caller = await callers.networkJwt(setup.userEmail);

      const signed = await caller.decision.signProposalAttachmentUploadUrl({
        proposalId: proposal.id,
        fileName: 'common.png',
      });
      await uploadTestObject(signed.storagePath);

      const result = await caller.decision.uploadProposalAttachment({
        storagePath: signed.storagePath,
        fileName: 'common.png',
        mimeType: 'image/png',
        proposalId: proposal.id,
      });

      expect(result.fileName).toBe('common.png');
      expect(result.id).toBeDefined();
    },
  ),
});
