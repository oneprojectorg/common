import { db, eq } from '@op/db/client';
import { attachments, proposalAttachments } from '@op/db/schema';
import { describe, expect, it } from 'vitest';

import { appRouter } from '..';
import { TestDecisionsDataManager } from '../../test/helpers/TestDecisionsDataManager';
import {
  createIsolatedSession,
  createTestContextWithSession,
} from '../../test/supabase-utils';
import { createCallerFactory } from '../../trpcFactory';
import { MAX_FILE_SIZE } from '../../utils';

const createCaller = createCallerFactory(appRouter);

async function createAuthenticatedCaller(email: string) {
  const { session } = await createIsolatedSession(email);
  return createCaller(await createTestContextWithSession(session));
}

/**
 * Small valid base64 PNG (1x1 transparent pixel).
 * This is a real image that Supabase storage will accept.
 */
const VALID_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

/**
 * Creates a base64 string that decodes to approximately the given number of bytes.
 * Used to test file size limits.
 */
function createBase64OfSize(bytes: number): string {
  // base64 encodes 3 bytes into 4 characters
  const neededChars = Math.ceil((bytes * 4) / 3);
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  for (let i = 0; i < neededChars; i++) {
    result += chars[i % chars.length];
  }
  // Pad to make valid base64
  while (result.length % 4 !== 0) {
    result += '=';
  }
  return result;
}

describe.concurrent('uploadProposalAttachment', () => {
  it('should upload a valid PNG file without proposalId', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 0,
      grantAccess: false,
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.uploadProposalAttachment({
      file: VALID_PNG_BASE64,
      fileName: 'test-image.png',
      mimeType: 'image/png',
    });

    expect(result.url).toBeDefined();
    expect(result.url).toContain('token=');
    expect(result.fileName).toMatch(/test-image\.png$/);
    expect(result.mimeType).toBe('image/png');
    expect(result.id).toBeDefined();
    expect(result.fileSize).toBeGreaterThan(0);
  });

  it('should upload and link attachment when proposalId is provided', async ({
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
      proposalData: { title: 'Test Proposal' },
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.uploadProposalAttachment({
      file: VALID_PNG_BASE64,
      fileName: 'proposal-image.png',
      mimeType: 'image/png',
      proposalId: proposal.id,
    });

    expect(result.id).toBeDefined();

    // Verify the proposal attachment link was created
    const [link] = await db
      .select()
      .from(proposalAttachments)
      .where(eq(proposalAttachments.attachmentId, result.id));

    expect(link).toBeDefined();
    expect(link?.proposalId).toBe(proposal.id);
  });

  it('should handle data URL format (data:image/png;base64,...)', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({
      instanceCount: 0,
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);
    const dataUrl = `data:image/png;base64,${VALID_PNG_BASE64}`;

    const result = await caller.decision.uploadProposalAttachment({
      file: dataUrl,
      fileName: 'data-url-image.png',
      mimeType: 'image/png',
    });

    expect(result.url).toBeDefined();
    expect(result.id).toBeDefined();
  });

  it('should accept JPEG files', async ({ task, onTestFinished }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 0 });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.uploadProposalAttachment({
      file: VALID_PNG_BASE64,
      fileName: 'test.jpg',
      mimeType: 'image/jpeg',
    });

    expect(result.mimeType).toBe('image/jpeg');
  });

  it('should accept WebP files', async ({ task, onTestFinished }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 0 });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.uploadProposalAttachment({
      file: VALID_PNG_BASE64,
      fileName: 'test.webp',
      mimeType: 'image/webp',
    });

    expect(result.mimeType).toBe('image/webp');
  });

  it('should accept GIF files', async ({ task, onTestFinished }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 0 });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.uploadProposalAttachment({
      file: VALID_PNG_BASE64,
      fileName: 'test.gif',
      mimeType: 'image/gif',
    });

    expect(result.mimeType).toBe('image/gif');
  });

  it('should accept PDF files', async ({ task, onTestFinished }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 0 });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.uploadProposalAttachment({
      file: VALID_PNG_BASE64,
      fileName: 'document.pdf',
      mimeType: 'application/pdf',
    });

    expect(result.mimeType).toBe('application/pdf');
  });

  it('should reject unsupported MIME types', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 0 });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.decision.uploadProposalAttachment({
        file: VALID_PNG_BASE64,
        fileName: 'script.js',
        mimeType: 'application/javascript',
      }),
    ).rejects.toMatchObject({
      message: expect.stringContaining('Unsupported file type'),
    });
  });

  it('should reject text/html MIME type', async ({ task, onTestFinished }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 0 });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.decision.uploadProposalAttachment({
        file: VALID_PNG_BASE64,
        fileName: 'page.html',
        mimeType: 'text/html',
      }),
    ).rejects.toMatchObject({
      message: expect.stringContaining('Unsupported file type'),
    });
  });

  it('should reject files exceeding MAX_FILE_SIZE', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 0 });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    // Create a base64 string that decodes to just over MAX_FILE_SIZE
    const oversizedBase64 = createBase64OfSize(MAX_FILE_SIZE + 1000);

    await expect(
      caller.decision.uploadProposalAttachment({
        file: oversizedBase64,
        fileName: 'large-file.png',
        mimeType: 'image/png',
      }),
    ).rejects.toMatchObject({
      message: expect.stringContaining('File too large'),
    });
  });

  it('should reject invalid data URL format (missing comma)', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 0 });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.decision.uploadProposalAttachment({
        file: 'data:image/png;base64', // Missing comma and data
        fileName: 'invalid.png',
        mimeType: 'image/png',
      }),
    ).rejects.toMatchObject({
      message: expect.stringContaining('Invalid'),
    });
  });

  it('should sanitize filenames with special characters', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 0 });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.uploadProposalAttachment({
      file: VALID_PNG_BASE64,
      fileName: 'test file [draft] @2024.png',
      mimeType: 'image/png',
    });

    // Spaces and brackets should be sanitized
    expect(result.fileName).not.toContain(' ');
    expect(result.fileName).not.toContain('[');
    expect(result.fileName).not.toContain('@');
  });

  it('should create attachment record in database', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 0 });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    const result = await caller.decision.uploadProposalAttachment({
      file: VALID_PNG_BASE64,
      fileName: 'db-test.png',
      mimeType: 'image/png',
    });

    // Verify attachment record was created in database
    const [dbAttachment] = await db
      .select()
      .from(attachments)
      .where(eq(attachments.id, result.id));

    expect(dbAttachment).toBeDefined();
    expect(dbAttachment?.fileName).toMatch(/db-test\.png$/);
    expect(dbAttachment?.mimeType).toBe('image/png');
    expect(dbAttachment?.storageObjectId).toBeDefined();
  });
});

describe.concurrent('deleteProposalAttachment', () => {
  it('should allow uploader to delete their attachment', async ({
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
      proposalData: { title: 'Test Proposal' },
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    // Upload attachment
    const attachment = await caller.decision.uploadProposalAttachment({
      file: VALID_PNG_BASE64,
      fileName: 'test.png',
      mimeType: 'image/png',
      proposalId: proposal.id,
    });

    // Delete attachment
    await caller.decision.deleteProposalAttachment({
      attachmentId: attachment.id,
      proposalId: proposal.id,
    });

    // Verify link was deleted
    const [link] = await db
      .select()
      .from(proposalAttachments)
      .where(eq(proposalAttachments.attachmentId, attachment.id));

    expect(link).toBeUndefined();

    // Verify attachment record still exists (soft delete - only removes link)
    const [attachmentRecord] = await db
      .select()
      .from(attachments)
      .where(eq(attachments.id, attachment.id));

    expect(attachmentRecord).toBeDefined();
  });

  it('should reject deletion by non-uploader', async ({
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
      proposalData: { title: 'Test Proposal' },
    });

    const ownerCaller = await createAuthenticatedCaller(setup.userEmail);

    // Owner uploads attachment
    const attachment = await ownerCaller.decision.uploadProposalAttachment({
      file: VALID_PNG_BASE64,
      fileName: 'test.png',
      mimeType: 'image/png',
      proposalId: proposal.id,
    });

    // Create another member
    const otherMember = await testData.createMemberUser({
      organization: setup.organization,
      instanceProfileIds: [instance.profileId],
    });

    const otherCaller = await createAuthenticatedCaller(otherMember.email);

    // Other user tries to delete
    await expect(
      otherCaller.decision.deleteProposalAttachment({
        attachmentId: attachment.id,
        proposalId: proposal.id,
      }),
    ).rejects.toMatchObject({
      message: 'Not authorized to delete this attachment',
    });
  });

  it('should reject deletion of non-existent attachment link', async ({
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
      proposalData: { title: 'Test Proposal' },
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    await expect(
      caller.decision.deleteProposalAttachment({
        attachmentId: '00000000-0000-0000-0000-000000000000',
        proposalId: proposal.id,
      }),
    ).rejects.toMatchObject({
      message: 'Attachment not found on this proposal',
    });
  });

  it('should reject deletion when attachment is on different proposal', async ({
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

    // Create two proposals
    const proposal1 = await testData.createProposal({
      callerEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Proposal 1' },
    });

    const proposal2 = await testData.createProposal({
      callerEmail: setup.userEmail,
      processInstanceId: instance.instance.id,
      proposalData: { title: 'Proposal 2' },
    });

    const caller = await createAuthenticatedCaller(setup.userEmail);

    // Upload to proposal1
    const attachment = await caller.decision.uploadProposalAttachment({
      file: VALID_PNG_BASE64,
      fileName: 'test.png',
      mimeType: 'image/png',
      proposalId: proposal1.id,
    });

    // Try to delete from proposal2
    await expect(
      caller.decision.deleteProposalAttachment({
        attachmentId: attachment.id,
        proposalId: proposal2.id,
      }),
    ).rejects.toMatchObject({
      message: 'Attachment not found on this proposal',
    });
  });
});
