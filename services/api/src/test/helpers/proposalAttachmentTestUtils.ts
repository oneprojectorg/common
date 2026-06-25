import type { AllowedProposalAttachmentMimeType } from '@op/common';
import { Buffer } from 'node:buffer';

import {
  createAuthenticatedCaller,
  supabaseTestAdminClient,
} from '../supabase-utils';

type AuthenticatedCaller = Awaited<
  ReturnType<typeof createAuthenticatedCaller>
>;

// 1x1 PNG; small enough to keep tests cheap, still a valid image.
const TEST_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const TEST_PNG_BUFFER = Buffer.from(TEST_PNG_BASE64, 'base64');

/**
 * Runs the production attachment-upload sequence end-to-end via a tRPC
 * caller: sign URL, PUT to storage (via service-role admin client), record.
 * Returns the recorded attachment row.
 */
export const uploadProposalAttachmentForTest = async ({
  caller,
  proposalId,
  fileName,
  mimeType = 'image/png',
  body = TEST_PNG_BUFFER,
}: {
  caller: AuthenticatedCaller;
  proposalId: string;
  fileName: string;
  mimeType?: AllowedProposalAttachmentMimeType;
  body?: Buffer;
}) => {
  const signed = await caller.decision.signProposalAttachmentUploadUrl({
    proposalId,
    fileName,
  });

  const { error } = await supabaseTestAdminClient.storage
    .from('assets')
    .upload(signed.storagePath, body, {
      contentType: mimeType,
      upsert: false,
    });
  if (error) {
    throw new Error(`proposalAttachment test upload failed: ${error.message}`);
  }

  return caller.decision.uploadProposalAttachment({
    storagePath: signed.storagePath,
    fileName,
    mimeType,
    proposalId,
  });
};
