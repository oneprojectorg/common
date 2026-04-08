import { db } from '@op/db/client';
import { createSBServiceClient } from '@op/supabase/server';

import {
  type ProposalAttachment,
  proposalAttachmentSchema,
} from './schemas/proposal';

/** Fetches proposal attachments with signed URLs for a single proposal. */
export async function getProposalAttachmentsWithSignedUrls(
  proposalId: string,
): Promise<ProposalAttachment[]> {
  const proposalAttachmentJoins = await db.query.proposalAttachments.findMany({
    where: {
      proposalId,
    },
    with: {
      attachment: {
        with: {
          storageObject: true,
        },
      },
    },
  });

  if (proposalAttachmentJoins.length === 0) {
    return [];
  }

  const supabase = createSBServiceClient();
  const attachmentsWithUrls = await Promise.all(
    proposalAttachmentJoins.map(async (join) => {
      const storagePath = join.attachment.storageObject?.name;
      if (!storagePath) {
        return { ...join, attachment: { ...join.attachment, url: undefined } };
      }
      const { data } = await supabase.storage
        .from('assets')
        .createSignedUrl(storagePath, 60 * 60 * 24);
      return {
        ...join,
        attachment: { ...join.attachment, url: data?.signedUrl },
      };
    }),
  );

  return attachmentsWithUrls.map((item) =>
    proposalAttachmentSchema.parse(item),
  );
}
