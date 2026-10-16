import { db } from '@op/db/client';

import { signStorageDownloadUrlOrNull } from '../../utils/signStorageDownloadUrl';
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

  const attachmentsWithUrls = await Promise.all(
    proposalAttachmentJoins.map(async (join) => {
      const storagePath = join.attachment.storageObject?.name;
      if (!storagePath) {
        return { ...join, attachment: { ...join.attachment, url: undefined } };
      }
      // 4-hour TTL — the review pane re-fetches on each open
      const url =
        (await signStorageDownloadUrlOrNull({
          storagePath,
          ttlSeconds: 60 * 60 * 4,
        })) ?? undefined;
      return { ...join, attachment: { ...join.attachment, url } };
    }),
  );

  return attachmentsWithUrls.map((item) =>
    proposalAttachmentSchema.parse(item),
  );
}
