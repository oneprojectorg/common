import { db } from '@op/db/client';
import { attachments, proposalAttachments } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { assertAccess, permission } from 'access-zones';

import { CommonError } from '../../utils';
import { getCurrentProfileId, getOrgAccessUser } from '../access';
import { assertOrganizationByProfileId } from '../assert';

export interface UploadProposalAttachmentInput {
  /** Sanitized file name */
  fileName: string;
  mimeType: string;
  fileSize: number;
  /** Supabase storage object ID from the upload */
  storageObjectId: string;
  /** If provided, links attachment to proposal immediately */
  proposalId?: string;
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

  // Link attachment to proposal if proposalId provided
  if (proposalId) {
    await linkAttachmentToProposal({
      attachmentId: attachment.id,
      proposalId,
      profileId,
      user,
    });
  }

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
  user,
}: {
  attachmentId: string;
  proposalId: string;
  profileId: string;
  user: User;
}) {
  // NOTE: Revisit after we introduce collaborative editing of proposals.
  // Currently checks that user has decisions:UPDATE permission in the org.
  // May need to check proposal-level permissions (author, collaborator) instead.
  const proposal = await db.query.proposals.findFirst({
    where: { id: proposalId },
    with: {
      processInstance: true,
    },
  });

  if (!proposal?.processInstance) {
    throw new CommonError('Proposal or process instance not found');
  }

  const processInstance = proposal.processInstance;

  const org = await assertOrganizationByProfileId(
    processInstance.ownerProfileId,
  );
  const orgUser = await getOrgAccessUser({
    user: { id: user.id },
    organizationId: org.id,
  });

  assertAccess({ decisions: permission.UPDATE }, orgUser?.roles ?? []);

  await db.insert(proposalAttachments).values({
    proposalId,
    attachmentId,
    uploadedBy: profileId,
  });
}
