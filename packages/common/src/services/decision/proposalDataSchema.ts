import { z } from 'zod';

/**
 * Zod schema for proposal data with known fields.
 * Uses looseObject to allow additional fields from custom proposal templates.
 * Handles backward compatibility where 'content' maps to 'description'.
 */
export const proposalDataSchema = z
  .looseObject({
    title: z.string().optional(),
    description: z.string().optional(),
    content: z.string().optional(), // backward compatibility
    category: z.string().optional(),
    budget: z.number().optional(),
    attachmentIds: z.array(z.string()).optional().prefault([]),
    collaborationDocId: z.string().optional(),
  })
  .transform((data) => {
    // Handle backward compatibility: content → description
    if (data.content && !data.description) {
      data.description = data.content;
    }
    return data;
  });

/** Parsed proposal data with defaults applied */
export type ProposalData = z.infer<typeof proposalDataSchema>;

/** Input type for proposal data (before parsing/defaults) */
export type ProposalDataInput = z.input<typeof proposalDataSchema>;

/**
 * Safely parse proposal data with fallback to empty object.
 * Returns typed ProposalData on success, or the raw input cast to ProposalData on failure.
 */
export function parseProposalData(proposalData: unknown): ProposalData {
  const result = proposalDataSchema.safeParse(proposalData);
  return result.success ? result.data : { attachmentIds: [] };
}
