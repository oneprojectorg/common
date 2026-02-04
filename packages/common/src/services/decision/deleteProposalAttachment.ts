import { and, db, eq } from '@op/db/client';
import { proposalAttachments } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { CommonError, UnauthorizedError } from '../../utils';
import { getCurrentProfileId } from '../access';

/**
 * Deletes the link between an attachment and a proposal.
 * Only the original uploader can delete their attachment.
 * This is a soft delete - the attachment record itself is preserved.
 */
export async function deleteProposalAttachment({
  attachmentId,
  proposalId,
  user,
}: {
  attachmentId: string;
  proposalId: string;
  user: User;
}) {
  const profileId = await getCurrentProfileId(user.id);

  // Verify the attachment link exists and user has permission (they uploaded it)
  const existingLink = await db.query.proposalAttachments.findFirst({
    where: {
      proposalId,
      attachmentId,
    },
  });

  if (!existingLink) {
    throw new CommonError('Attachment not found on this proposal');
  }

  // Only the uploader can delete
  if (existingLink.uploadedBy !== profileId) {
    throw new UnauthorizedError('Not authorized to delete this attachment');
  }

  // Delete the link (soft delete - keeps the attachment record)
  await db
    .delete(proposalAttachments)
    .where(
      and(
        eq(proposalAttachments.proposalId, proposalId),
        eq(proposalAttachments.attachmentId, attachmentId),
      ),
    );
}
