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
  // Fetch all data in parallel
  const [profileId, existingLink, proposal] = await Promise.all([
    getCurrentProfileId(user.id),
    db.query.proposalAttachments.findFirst({
      where: {
        proposalId,
        attachmentId,
      },
    }),
    db.query.proposals.findFirst({
      where: { id: proposalId },
    }),
  ]);

  if (!existingLink) {
    throw new CommonError('Attachment not found on this proposal');
  }

  if (!proposal) {
    throw new CommonError('Proposal not found');
  }

  // NOTE: Revisit after we introduce collaborative editing of proposals.
  // Currently only the proposal owner can delete attachments.
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
