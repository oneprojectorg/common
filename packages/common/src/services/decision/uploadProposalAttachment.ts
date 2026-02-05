import { db } from '@op/db/client';
import { attachments, proposalAttachments } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { CommonError, UnauthorizedError } from '../../utils';
import { getCurrentProfileId } from '../access';

export interface UploadProposalAttachmentInput {
  /** Sanitized file name */
  fileName: string;
  mimeType: string;
  fileSize: number;
  /** Supabase storage object ID from the upload */
  storageObjectId: string;
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
 * Creates an attachment record and optionally links it to a proposal.
 * The actual file upload to storage should be done before calling this.
 */
export async function uploadProposalAttachment({
  input,
  user,
}: {
  input: UploadProposalAttachmentInput;
  user: User;
}): Promise<UploadProposalAttachmentResult> {
  const { fileName, mimeType, fileSize, storageObjectId, proposalId } = input;
  const profileId = await getCurrentProfileId(user.id);

  // Create attachment record in database
  const [attachment] = await db
    .insert(attachments)
    .values({
      storageObjectId,
      fileName,
      mimeType,
      fileSize,
      profileId,
    })
    .returning();

  if (!attachment) {
    throw new CommonError('Failed to create attachment record');
  }

  // Link attachment to proposal
  await linkAttachmentToProposal({
    attachmentId: attachment.id,
    proposalId,
    profileId,
  });

  return {
    id: attachment.id,
    fileName,
    mimeType,
    fileSize,
  };
}

/**
 * Links an existing attachment to a proposal with permission checks.
 */
async function linkAttachmentToProposal({
  attachmentId,
  proposalId,
  profileId,
}: {
  attachmentId: string;
  proposalId: string;
  profileId: string;
}) {
  // NOTE: Revisit after we introduce collaborative editing of proposals.
  // Currently only the proposal owner can attach files.
  const proposal = await db.query.proposals.findFirst({
    where: { id: proposalId },
  });

  if (!proposal) {
    throw new CommonError('Proposal not found');
  }

  if (proposal.submittedByProfileId !== profileId) {
    throw new UnauthorizedError('Only the proposal owner can add attachments');
  }

  await db.insert(proposalAttachments).values({
    proposalId,
    attachmentId,
    uploadedBy: profileId,
  });
}
