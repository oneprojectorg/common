import { db, eq } from '@op/db/client';
import { attachments, proposalAttachments, proposals } from '@op/db/schema';

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
export async function processProposalContent(proposalId: string): Promise<void> {
  try {
    // Get the proposal content
    const proposal = await db.query.proposals.findFirst({
      where: eq(proposals.id, proposalId),
    });

    if (!proposal) {
      console.error(`Proposal not found: ${proposalId}`);
      return;
    }

    const proposalData = proposal.proposalData as any;
    const content = proposalData?.content || '';

    if (!content) {
      console.log(`No content to process for proposal: ${proposalId}`);
      return;
    }

    // Get all attachments for this proposal through the join table
    const proposalAttachmentJoins = await db.query.proposalAttachments.findMany({
      where: eq(proposalAttachments.proposalId, proposalId),
      with: {
        attachment: true,
      },
    });

    if (proposalAttachmentJoins.length === 0) {
      console.log(`No attachments to process for proposal: ${proposalId}`);
      return;
    }

    // Extract image URLs from content
    const imageUrls = extractImageUrlsFromContent(content);
    
    if (imageUrls.length === 0) {
      console.log(`No image URLs found in proposal content: ${proposalId}`);
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
          console.error(`Failed to generate public URL for ${attachment.storageObjectId}`);
          continue;
        }

        // Find the corresponding temporary URL in content and replace it
        const tempUrl = imageUrls.find(url => url.includes(attachment.storageObjectId));
        if (tempUrl) {
          processedContent = processedContent.replace(tempUrl, publicUrl);
          console.log(`Replaced temporary URL with public URL: ${tempUrl} -> ${publicUrl}`);
        }

        // Update attachment metadata (use existing data from attachment record)
        updatedAttachments.push({
          id: attachment.id,
          fileName: attachment.fileName || 'unknown',
          mimeType: attachment.mimeType || 'image/*',
          fileSize: attachment.fileSize || 0,
        });
      } catch (error) {
        console.error(`Error processing attachment ${attachment.id}:`, error);
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

      console.log(`Updated proposal content for ${proposalId}`);
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

      console.log(`Updated ${updatedAttachments.length} attachment metadata for proposal ${proposalId}`);
    }

  } catch (error) {
    console.error(`Error processing proposal content for ${proposalId}:`, error);
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

/**
 * Get permanent URLs for proposal attachments
 */
export async function getProposalAttachmentUrls(proposalId: string): Promise<Record<string, string>> {
  const proposalAttachmentJoins = await db.query.proposalAttachments.findMany({
    where: eq(proposalAttachments.proposalId, proposalId),
    with: {
      attachment: true,
    },
  });

  if (proposalAttachmentJoins.length === 0) {
    return {};
  }

  const urlMap: Record<string, string> = {};

  for (const proposalAttachmentJoin of proposalAttachmentJoins) {
    const attachment = proposalAttachmentJoin.attachment as any;
    if (!attachment) continue;
    
    try {
      // Generate permanent public URL using Next.js rewrite
      const storagePath = `profile/${attachment.storageObjectId}`;
      const publicUrl = getPublicUrl(storagePath);
      
      if (publicUrl) {
        urlMap[attachment.id] = publicUrl;
      }
    } catch (error) {
      console.error(`Error getting URL for attachment ${attachment.id}:`, error);
    }
  }

  return urlMap;
}