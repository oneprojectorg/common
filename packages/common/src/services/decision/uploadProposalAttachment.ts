import { db } from '@op/db/client';
import { attachments, proposalAttachments } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { CommonError } from '../../utils';
import {
  ASSETS_BUCKET,
  assertUploadedStorageObject,
} from '../../utils/storage';
import { getStorageObjectByPath } from '../../utils/storageObject';
import { getCurrentProfileId } from '../access';
import { assertProfileAccess } from '../assert';
import {
  MAX_PROPOSAL_ATTACHMENT_FILE_SIZE,
  proposalAttachmentPathPrefix,
} from './proposalAttachmentStorage';

export interface UploadProposalAttachmentInput {
  /** User-supplied display name; persisted on the attachment row. */
  fileName: string;
  /** Client-declared MIME type; must match what storage recorded on PUT. */
  mimeType: string;
  /** Path of the storage object the client just uploaded into. */
  storagePath: string;
  /** Links attachment to proposal */
  proposalId: string;
}

export interface UploadProposalAttachmentResult {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
}

/**
 * Records a proposal attachment that the client uploaded directly to storage
 * via a signed URL (see {@link signProposalAttachmentUploadUrl}). The signed
 * PUT bypasses the serverless body-size limit that previously broke larger
 * iPhone photos when we round-tripped them as base64 JSON.
 */
export async function uploadProposalAttachment({
  input,
  user,
}: {
  input: UploadProposalAttachmentInput;
  user: User;
}): Promise<UploadProposalAttachmentResult> {
  const { fileName, mimeType, storagePath, proposalId } = input;

  const [profileId, proposal, storageObject] = await Promise.all([
    getCurrentProfileId(user.id),
    db.query.proposals.findFirst({
      where: { id: proposalId },
    }),
    getStorageObjectByPath({ bucketId: ASSETS_BUCKET, path: storagePath }),
  ]);

  if (!proposal) {
    throw new CommonError('Proposal not found');
  }

  await assertProfileAccess({
    user: { id: user.id },
    profileId: proposal.profileId,
    permissions: { profile: permission.UPDATE },
  });

  const { storageObjectId, storedMimeType, fileSize } =
    assertUploadedStorageObject({
      storageObject,
      storagePath,
      requiredPathPrefix: proposalAttachmentPathPrefix(profileId),
      declaredMimeType: mimeType,
      maxFileSize: MAX_PROPOSAL_ATTACHMENT_FILE_SIZE,
    });

  const [attachment] = await db
    .insert(attachments)
    .values({
      storageObjectId,
      fileName,
      mimeType: storedMimeType,
      fileSize,
      profileId,
    })
    .returning();

  if (!attachment) {
    throw new CommonError('Failed to create attachment record');
  }

  await db.insert(proposalAttachments).values({
    proposalId,
    attachmentId: attachment.id,
    uploadedBy: profileId,
  });

  return {
    id: attachment.id,
    fileName,
    mimeType: storedMimeType,
    fileSize,
  };
}
