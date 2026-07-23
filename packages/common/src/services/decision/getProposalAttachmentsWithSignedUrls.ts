import { db } from '@op/db/client';

import { getResourceSignedUrls } from '../resources/storage';
import {
  type ProposalAttachment,
  proposalAttachmentSchema,
} from './schemas/proposal';

// The review pane re-fetches on each open, so a 4h token comfortably outlives
// a session without minting a long-lived URL.
const ATTACHMENT_SIGNED_URL_TTL_SECONDS = 60 * 60 * 4;

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

  const signedUrls = await getResourceSignedUrls({
    filePaths: proposalAttachmentJoins.flatMap((join) =>
      join.attachment.storageObject?.name
        ? [join.attachment.storageObject.name]
        : [],
    ),
    ttlSeconds: ATTACHMENT_SIGNED_URL_TTL_SECONDS,
  });

  return proposalAttachmentJoins.map((join) => {
    const storagePath = join.attachment.storageObject?.name;
    const url = storagePath
      ? (signedUrls.get(storagePath) ?? undefined)
      : undefined;
    return proposalAttachmentSchema.parse({
      ...join,
      attachment: { ...join.attachment, url },
    });
  });
}
