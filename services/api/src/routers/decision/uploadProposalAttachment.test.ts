import { db } from '@op/db/client';
import { describe, expect, it } from 'vitest';

import { appRouter } from '..';
import { TestDecisionsDataManager } from '../../test/helpers/TestDecisionsDataManager';
import { VALID_PNG_BUFFER } from '../../test/helpers/uploadProposalAttachmentFixture';
import {
  accessTierGatingCell,
  describeDecisionAccessTierGating,
  expectFailsAccessTierGate,
} from '../../test/helpers/gating/decision';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../test/supabase-utils';
import { createCallerFactory } from '../../trpcFactory';
import { STORAGE_BUCKET, createStorageAdmin } from '../../utils/storage';

const createCaller = createCallerFactory(appRouter);

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

async function uploadFixtureToPath(path: string, mimeType: string) {
  const supabase = createStorageAdmin();
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, VALID_PNG_BUFFER, { contentType: mimeType, upsert: true });

  if (error) {
    throw error;
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

    const { path } = await caller.decision.createProposalAttachmentUploadUrl({
      proposalId: proposal.id,
      fileName: 'test-image.png',
      mimeType: 'image/png',
      fileSize: VALID_PNG_BUFFER.length,
    });

    await uploadFixtureToPath(path, 'image/png');

    const result = await caller.decision.uploadProposalAttachment({
      proposalId: proposal.id,
      path,
      fileName: 'test-image.png',
    });

    expect(result).toMatchObject({
      fileName: 'test-image.png',
      mimeType: 'image/png',
    });
    expect(result.id).toBeDefined();
    expect(result.fileSize).toBeGreaterThan(0);

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

    const setupA = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instance = setupA.instances[0];
    if (!instance) {
      throw new Error('No instance created');
    }

    const proposal = await testData.createProposal({
      userEmail: setupA.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Test Proposal', description: 'A test' },
    });

    const member = await testData.createMemberUser({
      organization: setupA.organization,
    });

    await testData.grantProfileAccess(
      proposal.profileId,
      member.authUserId,
      member.email,
    );

    const memberCaller = await createAuthenticatedCaller(member.email);

    const { path } =
      await memberCaller.decision.createProposalAttachmentUploadUrl({
        proposalId: proposal.id,
        fileName: 'member-upload.png',
        mimeType: 'image/png',
        fileSize: VALID_PNG_BUFFER.length,
      });

    await uploadFixtureToPath(path, 'image/png');

    const result = await memberCaller.decision.uploadProposalAttachment({
      proposalId: proposal.id,
      path,
      fileName: 'member-upload.png',
    });

    expect(result).toMatchObject({
      fileName: 'member-upload.png',
      mimeType: 'image/png',
    });
    expect(result.id).toBeDefined();
    expect(result.fileSize).toBeGreaterThan(0);

    const link = await db.query.proposalAttachments.findFirst({
      where: {
        proposalId: proposal.id,
        attachmentId: result.id,
      },
    });
    expect(link).toBeDefined();
  });

  it('should reject upload-url creation from user without proposal permissions', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);

    const setupA = await testData.createDecisionSetup({
      instanceCount: 1,
      grantAccess: true,
    });

    const instanceA = setupA.instances[0];
    if (!instanceA) {
      throw new Error('No instance created');
    }

    const proposal = await testData.createProposal({
      userEmail: setupA.userEmail,
      processInstanceId: instanceA.instance.id,
      proposalData: { title: 'Test Proposal', description: 'A test' },
    });

    const setupB = await testData.createDecisionSetup({
      instanceCount: 0,
      grantAccess: false,
    });

    const nonOwnerCaller = await createAuthenticatedCaller(setupB.userEmail);

    await expect(
      nonOwnerCaller.decision.createProposalAttachmentUploadUrl({
        proposalId: proposal.id,
        fileName: 'malicious.png',
        mimeType: 'image/png',
        fileSize: VALID_PNG_BUFFER.length,
      }),
    ).rejects.toMatchObject({
      cause: { name: 'UnauthorizedError' },
    });
  });

  it('should reject record call with path that does not belong to caller', async ({
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

    await expect(
      caller.decision.uploadProposalAttachment({
        proposalId: proposal.id,
        path: 'profile/some-other-profile/proposals/other/file.png',
        fileName: 'spoofed.png',
      }),
    ).rejects.toMatchObject({
      cause: { name: 'UnauthorizedError' },
      message: 'Invalid attachment path',
    });
  });
});

describeDecisionAccessTierGating('uploadProposalAttachment', {
  noJwtNonPublic: accessTierGatingCell(
    'rejects no-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
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
        proposalData: { title: 'no-JWT should not reach this' },
      });

      const caller = await callers.noJwt();

      await expectFailsAccessTierGate(
        caller.decision.uploadProposalAttachment({
          file: VALID_PNG_BASE64,
          fileName: 'no-jwt.png',
          mimeType: 'image/png',
          proposalId: proposal.id,
        }),
        'none',
      );
    },
  ),

  anonJwtNonPublic: accessTierGatingCell(
    'rejects anon-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
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
        proposalData: { title: 'anon should bounce' },
      });

      const caller = await callers.anonJwt();

      await expectFailsAccessTierGate(
        caller.decision.uploadProposalAttachment({
          file: VALID_PNG_BASE64,
          fileName: 'anon.png',
          mimeType: 'image/png',
          proposalId: proposal.id,
        }),
        'anon',
      );
    },
  ),

  userJwtNonPublic: accessTierGatingCell(
    'rejects user-JWT caller on non-public instance',
    async ({ task, onTestFinished, callers }) => {
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
        proposalData: { title: 'anon should bounce' },
      });

      const caller = await callers.userJwt();

      await expectFailsAccessTierGate(
        caller.decision.uploadProposalAttachment({
          file: VALID_PNG_BASE64,
          fileName: 'anon.png',
          mimeType: 'image/png',
          proposalId: proposal.id,
        }),
        'user',
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
      const instance = setup.instances[0];
      if (!instance) {
        throw new Error('No instance created');
      }
      const proposal = await testData.createProposal({
        userEmail: setup.userEmail,
        processInstanceId: instance.instance.id,
        proposalData: { title: 'Common-JWT owner uploads' },
      });

      const caller = await callers.networkJwt(setup.userEmail);

      const result = await caller.decision.uploadProposalAttachment({
        file: VALID_PNG_BASE64,
        fileName: 'common.png',
        mimeType: 'image/png',
        proposalId: proposal.id,
      });

      expect(result.fileName).toBe('common.png');
      expect(result.id).toBeDefined();
    },
  ),
});
