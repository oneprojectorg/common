import { and, db, eq } from '@op/db/client';
import { proposalAttachments } from '@op/db/schema';
import type { ClaimsUser } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { CommonError } from '../../utils';
import { assertProfileAccess } from '../assert';

/**
 * Deletes the link between an attachment and a proposal.
 * Any user with profile:UPDATE permission on the proposal can delete attachments.
 * This is a soft delete - the attachment record itself is preserved.
 */
export async function deleteProposalAttachment({
  attachmentId,
  proposalId,
  user,
}: {
  attachmentId: string;
  proposalId: string;
  user: ClaimsUser;
}) {
  // Fetch link and proposal in parallel
  const [existingLink, proposal] = await Promise.all([
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

  await assertProfileAccess({
    user: { id: user.id },
    profileId: proposal.profileId,
    permissions: { profile: permission.UPDATE },
  });

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
