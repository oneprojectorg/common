import he from 'he';
import { z } from 'zod';

import { formatCurrency, formatDate } from './formatting';

// Define the expected structure of proposalData with better type safety
export const proposalDataSchema = z
  .looseObject({
    title: z.string().optional(),
    description: z.string().optional(), // Schema expects 'description'
    content: z.string().optional(), // Keep for backward compatibility
    category: z.string().optional(),
    budget: z.number().optional(),
    attachmentIds: z.array(z.string()).optional().prefault([]),
  }) // Allow additional fields
  .transform((data) => {
    // Handle backward compatibility: if content exists but not description, use content as description
    if (data.content && !data.description) {
      data.description = data.content;
    }
    return data;
  });

export type ProposalData = z.infer<typeof proposalDataSchema>;

/**
 * Safely parse proposal data with fallback to unknown structure
 */
export function parseProposalData(proposalData: unknown): ProposalData {
  const result = proposalDataSchema.safeParse(proposalData);
  return result.success ? result.data : (proposalData as any) || {};
}

// Re-export formatting utilities for backward compatibility
export { formatCurrency, formatDate };

/**
 * Safely extract text content from HTML without XSS vulnerability
 * Preserves line breaks from block-level HTML elements and slices by lines
 */
export function getTextPreview({
  content,
  maxLines = 1,
  maxLength = 300,
}: {
  content: string;
  maxLines?: number;
  maxLength?: number;
}): string {
  // First decode HTML entities (e.g., &lt;p&gt; becomes <p>)
  const decodedHtml = he.decode(content);

  // Replace block-level elements with newline markers before stripping HTML
  // This preserves semantic line breaks from paragraphs, divs, lists, etc.
  const withLineBreaks = decodedHtml
    .replace(/<\/?(p|div|li|h[1-6]|blockquote|tr)[^>]*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n');

  let text: string;

  if (typeof window === 'undefined') {
    // Server-side fallback - strip HTML tags with regex (basic but safe)
    text = withLineBreaks.replace(/<[^>]*>/g, '');
  } else {
    try {
      // Client-side - use DOMParser for safe HTML parsing
      const parser = new DOMParser();
      const doc = parser.parseFromString(withLineBreaks, 'text/html');
      text = doc.body.textContent || doc.body.innerText || '';
    } catch (error) {
      console.warn('Failed to parse HTML content:', error);
      // Fallback to regex stripping if DOMParser fails
      text = withLineBreaks.replace(/<[^>]*>/g, '');
    }
  }

  // Split by newlines and filter out empty lines
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  // Take first N lines
  const previewLines = lines.slice(0, maxLines);
  const preview = previewLines.join(' ');

  // Truncate if still too long and add ellipsis if there's more content
  const hasMoreLines = lines.length > maxLines;
  const truncated =
    preview.length > maxLength ? preview.substring(0, maxLength) : preview;

  return hasMoreLines || truncated.length < preview.length
    ? truncated + '…'
    : truncated;
}

/**
 * Extract unique submitters from proposals for display components like FacePile
 */
export function getUniqueSubmitters<
  T extends { submittedBy?: { id: string } | null },
>(proposals: T[]): Array<NonNullable<T['submittedBy']>> {
  return proposals.reduce(
    (acc, proposal) => {
      if (
        proposal.submittedBy &&
        !acc.some((s) => s.id === proposal.submittedBy?.id)
      ) {
        acc.push(proposal.submittedBy);
      }
      return acc;
    },
    [] as Array<NonNullable<T['submittedBy']>>,
  );
}
