import { and, db, eq } from '@op/db/client';
import { proposalAttachments } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { assertAccess, permission } from 'access-zones';

import { CommonError, UnauthorizedError } from '../../utils';
import { getProfileAccessUser } from '../access';

/**
 * Deletes the link between an attachment and a proposal.
 * Any user with decisions:UPDATE permission on the proposal's process instance can delete attachments.
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

  const profileUser = await getProfileAccessUser({
    user: { id: user.id },
    profileId: proposal.profileId,
  });

  if (!profileUser) {
    throw new UnauthorizedError('Not authorized');
  }

  assertAccess({ decisions: permission.UPDATE }, profileUser.roles);

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
