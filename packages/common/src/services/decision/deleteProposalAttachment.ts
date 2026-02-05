import { and, db, eq } from '@op/db/client';
import { proposalAttachments } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { CommonError, UnauthorizedError } from '../../utils';
import { getCurrentProfileId } from '../access';

/**
 * Deletes the link between an attachment and a proposal.
 * Only the proposal owner can delete attachments.
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

  // Verify the attachment link exists
  const existingLink = await db.query.proposalAttachments.findFirst({
    where: {
      proposalId,
      attachmentId,
    },
  });

  if (!existingLink) {
    throw new CommonError('Attachment not found on this proposal');
  }

  // NOTE: Revisit after we introduce collaborative editing of proposals.
  // Currently only the proposal owner can delete attachments.
  const proposal = await db.query.proposals.findFirst({
    where: { id: proposalId },
  });

  if (!proposal) {
    throw new CommonError('Proposal not found');
  }

  if (proposal.submittedByProfileId !== profileId) {
    throw new UnauthorizedError(
      'Only the proposal owner can delete attachments',
    );
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
