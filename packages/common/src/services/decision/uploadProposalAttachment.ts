import { db } from '@op/db/client';
import { attachments, proposalAttachments } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { assertAccess, permission } from 'access-zones';

import { CommonError } from '../../utils';
import { getCurrentProfileId, getProfileAccessUser } from '../access';

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

  // Fetch profile and proposal in parallel
  const [profileId, proposal] = await Promise.all([
    getCurrentProfileId(user.id),
    db.query.proposals.findFirst({
      where: { id: proposalId },
      with: { processInstance: true },
    }),
  ]);

  if (!proposal) {
    throw new CommonError('Proposal not found');
  }

  if (!proposal.processInstance.profileId) {
    throw new CommonError('Process instance has no associated profile');
  }

  // Assert the user has decisions:UPDATE permission on the instance profile
  const profileUser = await getProfileAccessUser({
    user: { id: user.id },
    profileId: proposal.processInstance.profileId,
  });

  assertAccess({ decisions: permission.UPDATE }, profileUser?.roles ?? []);

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
  await db.insert(proposalAttachments).values({
    proposalId,
    attachmentId: attachment.id,
    uploadedBy: profileId,
  });

  return {
    id: attachment.id,
    fileName,
    mimeType,
    fileSize,
  };
}
