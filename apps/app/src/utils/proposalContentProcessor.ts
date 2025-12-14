/**
 * Utility functions for processing proposal content and managing attachments
 */

export interface ImageAttachment {
  id: string;
  url: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
}

/**
 * Extract image URLs from rich text content
 */
export function extractImageUrlsFromContent(htmlContent: string): string[] {
  const imageUrls: string[] = [];

  // Create a temporary DOM parser to extract img src attributes
  if (typeof window !== 'undefined') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    const images = doc.querySelectorAll('img');

    images.forEach((img) => {
      const src = img.getAttribute('src');
      if (src) {
        imageUrls.push(src);
      }
    });
  } else {
    // Server-side: use regex as fallback
    const imgRegex = /<img[^>]+src="([^">]+)"/gi;
    let match;
    while ((match = imgRegex.exec(htmlContent)) !== null) {
      if (match[1]) {
        imageUrls.push(match[1]);
      }
    }
  }

  return imageUrls;
}

/**
 * Check if a URL is a temporary Supabase signed URL
 */
export function isTemporarySupabaseUrl(url: string): boolean {
  // Check for Supabase storage URLs with signed tokens
  return (
    url.includes('supabase') &&
    url.includes('/storage/') &&
    (url.includes('token=') || url.includes('X-Amz-'))
  );
}

/**
 * Replace image URLs in content with placeholder references
 * This allows us to replace them with permanent URLs later
 */
export function replaceImageUrlsWithPlaceholders(
  htmlContent: string,
  imageUrls: string[],
): string {
  let processedContent = htmlContent;

  imageUrls.forEach((url, index) => {
    const placeholder = `[IMAGE_ATTACHMENT_${index}]`;
    processedContent = processedContent.replace(url, placeholder);
  });

  return processedContent;
}

/**
 * Replace placeholder references with actual attachment URLs
 */
export function replacePlaceholdersWithUrls(
  htmlContent: string,
  attachmentUrls: string[],
): string {
  let processedContent = htmlContent;

  attachmentUrls.forEach((url, index) => {
    const placeholder = `[IMAGE_ATTACHMENT_${index}]`;
    processedContent = processedContent.replace(placeholder, url);
  });

  return processedContent;
}

/**
 * Extract attachment IDs from uploaded image URLs
 * This assumes the attachment ID is part of the URL path or can be derived
 */
export function extractAttachmentIdsFromUrls(
  imageUrls: string[],
  uploadedAttachments: ImageAttachment[],
): string[] {
  const attachmentIds: string[] = [];

  imageUrls.forEach((url) => {
    const attachment = uploadedAttachments.find((att) => att.url === url);
    if (attachment) {
      attachmentIds.push(attachment.id);
    }
  });

  return attachmentIds;
}
