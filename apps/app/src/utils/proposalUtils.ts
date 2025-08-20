import { z } from 'zod';

import { formatCurrency, formatDate } from './formatting';

// Define the expected structure of proposalData with better type safety
export const proposalDataSchema = z.object({
  title: z.string().optional(),
  content: z.string().optional(),
  category: z.string().optional(),
  budget: z.number().optional(),
  attachmentIds: z.array(z.string()).optional().default([]),
}).passthrough(); // Allow additional fields

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
 * Uses DOMParser instead of innerHTML for security
 */
export function getTextPreview(html: string, maxLength: number = 300): string {
  if (typeof window === 'undefined') {
    // Server-side fallback - strip HTML tags with regex (basic but safe)
    const text = html.replace(/<[^>]*>/g, '');
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }

  try {
    // Client-side - use DOMParser for safe HTML parsing
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const text = doc.body.textContent || doc.body.innerText || '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  } catch (error) {
    console.warn('Failed to parse HTML content:', error);
    // Fallback to regex stripping if DOMParser fails
    const text = html.replace(/<[^>]*>/g, '');
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }
}

/**
 * Generate proposal view URL
 */
export function getProposalViewUrl(
  slug: string,
  instanceId: string, 
  proposalId: string
): string {
  return `/profile/${slug}/decisions/${instanceId}/proposal/${proposalId}`;
}

/**
 * Extract unique submitters from proposals for display components like FacePile
 */
export function getUniqueSubmitters<T extends { submittedBy?: { id: string } | null }>(
  proposals: T[]
): Array<NonNullable<T['submittedBy']>> {
  return proposals.reduce((acc, proposal) => {
    if (
      proposal.submittedBy &&
      !acc.some((s) => s.id === proposal.submittedBy?.id)
    ) {
      acc.push(proposal.submittedBy);
    }
    return acc;
  }, [] as Array<NonNullable<T['submittedBy']>>);
}