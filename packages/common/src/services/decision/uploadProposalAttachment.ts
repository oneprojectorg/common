import { db } from '@op/db/client';
import { attachments, proposalAttachments } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { CommonError, NotFoundError, ValidationError } from '../../utils';
import {
  getStorageObjectMimeType,
  getStorageObjectSize,
  isAllowedUploadMimeType,
} from '../../utils/storage';
import { getStorageObjectByPath } from '../../utils/storageObject';
import { getCurrentProfileId } from '../access';
import { assertProfileAccess } from '../assert';
import {
  MAX_PROPOSAL_ATTACHMENT_FILE_SIZE,
  PROPOSAL_ATTACHMENT_BUCKET,
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
    getStorageObjectByPath({
      bucketId: PROPOSAL_ATTACHMENT_BUCKET,
      path: storagePath,
    }),
  ]);

  if (!proposal) {
    throw new CommonError('Proposal not found');
  }

  await assertProfileAccess({
    user: { id: user.id },
    profileId: proposal.profileId,
    permissions: { profile: permission.UPDATE },
  });

  if (!storageObject) {
    throw new NotFoundError('Storage object', storagePath);
  }

  // The signed URL is path-scoped, but the client supplies the path back to
  // us here — reject anything outside this profile's proposals/ prefix so a
  // caller can't claim someone else's just-uploaded object.
  if (!storagePath.startsWith(proposalAttachmentPathPrefix(profileId))) {
    throw new ValidationError('Storage object does not belong to this profile');
  }

  // Supabase records the Content-Type sent on PUT into the object metadata,
  // and serves the file back with that same header. Trust the storage record
  // (not the user's separate `mimeType` argument), and re-check the allowlist
  // here in case the client PUT with a Content-Type we don't accept.
  const storedMimeType = getStorageObjectMimeType(storageObject.metadata);
  if (!storedMimeType || !isAllowedUploadMimeType(storedMimeType)) {
    throw new ValidationError('Uploaded file has an unsupported content type');
  }
  if (storedMimeType !== mimeType) {
    throw new ValidationError(
      'Declared mimeType does not match the uploaded file',
    );
  }

  // Storage object size is the only place we see the actual upload size —
  // the signed PUT URL itself has no inherent cap. Reject before persisting
  // metadata so oversized blobs don't get an attachment row pointing at them.
  const fileSize = getStorageObjectSize(storageObject.metadata);
  if (fileSize === null || fileSize > MAX_PROPOSAL_ATTACHMENT_FILE_SIZE) {
    throw new ValidationError('Uploaded file exceeds the size limit');
  }

  // Create attachment record in database
  const [attachment] = await db
    .insert(attachments)
    .values({
      storageObjectId: storageObject.id,
      fileName,
      mimeType: storedMimeType,
      fileSize,
      profileId,
    })
    .returning();

  if (!attachment) {
    throw new CommonError('Failed to create attachment record');
  }

  // Link attachment to proposal
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
