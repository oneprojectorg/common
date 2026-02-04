import { CommonError, getCurrentProfileId } from '@op/common';
import { and, db, eq } from '@op/db/client';
import { proposalAttachments } from '@op/db/schema';
import { z } from 'zod';

import { commonAuthedProcedure, router } from '../../trpcFactory';

export const deleteProposalAttachment = router({
  deleteProposalAttachment: commonAuthedProcedure({
    rateLimit: { windowSize: 10, maxRequests: 20 },
  })
    .input(
      z.object({
        attachmentId: z.string(),
        proposalId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { attachmentId, proposalId } = input;
      const { user } = ctx;
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
        throw new CommonError('Not authorized to delete this attachment');
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
    }),
});
