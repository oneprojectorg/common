import { type DbClient, eq } from '@op/db/client';
import { attachments, proposalAttachments, proposals } from '@op/db/schema';
import { logger } from '@op/logging';

/**
 * Generate public URL for asset using Next.js rewrite
 */
const getPublicUrl = (key?: string | null) => {
  if (!key) {
    return;
  }
  return `/assets/${key}`;
};

/**
 * Process proposal content to replace temporary image URLs with permanent attachment references
 */
export async function processProposalContent({
  db,
  proposalId,
}: {
  db: DbClient;
  proposalId: string;
}): Promise<void> {
  try {
    // Get the proposal content
    const proposal = await db._query.proposals.findFirst({
      where: eq(proposals.id, proposalId),
    });

    if (!proposal) {
      logger.error('Proposal not found', { proposalId });
      return;
    }

    const proposalData = proposal.proposalData as any;
    const content = proposalData?.content || '';

    if (!content) {
      logger.debug('No content to process for proposal', { proposalId });
      return;
    }

    // Get all attachments for this proposal through the join table
    const proposalAttachmentJoins =
      await db._query.proposalAttachments.findMany({
        where: eq(proposalAttachments.proposalId, proposalId),
        with: {
          attachment: true,
        },
      });

    if (proposalAttachmentJoins.length === 0) {
      logger.debug('No attachments to process for proposal', { proposalId });
      return;
    }

    // Extract image URLs from content
    const imageUrls = extractImageUrlsFromContent(content);

    if (imageUrls.length === 0) {
      logger.debug('No image URLs found in proposal content', { proposalId });
      return;
    }

    // Process attachments and replace URLs with public asset URLs

    let processedContent = content;
    const updatedAttachments: Array<{
      id: string;
      fileName: string;
      mimeType: string;
      fileSize: number;
    }> = [];

    // Process each attachment
    for (const proposalAttachmentJoin of proposalAttachmentJoins) {
      const attachment = proposalAttachmentJoin.attachment as any;
      if (!attachment) continue;

      try {
        // Generate permanent public URL using the storage path
        const storagePath = `profile/${attachment.storageObjectId}`;
        const publicUrl = getPublicUrl(storagePath);

        if (!publicUrl) {
          logger.error('Failed to generate public URL', {
            storageObjectId: attachment.storageObjectId,
          });
          continue;
        }

        // Find the corresponding temporary URL in content and replace it
        const tempUrl = imageUrls.find((url) =>
          url.includes(attachment.storageObjectId),
        );
        if (tempUrl) {
          processedContent = processedContent.replace(tempUrl, publicUrl);
          logger.debug('Replaced temporary URL with public URL', {
            tempUrl,
            publicUrl,
          });
        }

        // Update attachment metadata (use existing data from attachment record)
        updatedAttachments.push({
          id: attachment.id,
          fileName: attachment.fileName || 'unknown',
          mimeType: attachment.mimeType || 'image/*',
          fileSize: attachment.fileSize || 0,
        });
      } catch (error) {
        logger.error('Error processing attachment', {
          attachmentId: attachment.id,
          error,
        });
      }
    }

    // Update the proposal content with processed URLs
    if (processedContent !== content) {
      const updatedProposalData = {
        ...proposalData,
        content: processedContent,
      };

      await db
        .update(proposals)
        .set({
          proposalData: updatedProposalData,
        })
        .where(eq(proposals.id, proposalId));

      logger.info('Updated proposal content', { proposalId });
    }

    // Update attachment metadata
    if (updatedAttachments.length > 0) {
      for (const attachmentUpdate of updatedAttachments) {
        await db
          .update(attachments)
          .set({
            fileName: attachmentUpdate.fileName,
            mimeType: attachmentUpdate.mimeType,
            fileSize: attachmentUpdate.fileSize,
          })
          .where(eq(attachments.id, attachmentUpdate.id));
      }

      logger.info('Updated attachment metadata for proposal', {
        proposalId,
        count: updatedAttachments.length,
      });
    }
  } catch (error) {
    logger.error('Error processing proposal content', { proposalId, error });
  }
}

/**
 * Extract image URLs from HTML content
 */
function extractImageUrlsFromContent(htmlContent: string): string[] {
  const imageUrls: string[] = [];
  const imgRegex = /<img[^>]+src="([^">]+)"/gi;
  let match;

  while ((match = imgRegex.exec(htmlContent)) !== null) {
    if (match[1]) {
      imageUrls.push(match[1]);
    }
  }

  return imageUrls;
}
