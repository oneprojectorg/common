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
    category: z
      .string()
      .nullish()
      .transform((v) => v ?? undefined),
    budget: z
      .union([z.string(), z.number()])
      .pipe(z.coerce.number())
      .nullish()
      .transform((v) => v ?? undefined),
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
 * Safely parse proposal data with fallback.
 * Returns typed ProposalData on success, or preserves raw input fields on failure.
 */
export function parseProposalData(proposalData: unknown): ProposalData {
  const result = proposalDataSchema.safeParse(proposalData);
  if (result.success) {
    return result.data;
  }

  // Fallback: preserve raw input fields if it's an object, with safe defaults
  const raw =
    proposalData && typeof proposalData === 'object'
      ? (proposalData as Record<string, unknown>)
      : {};

  return {
    ...raw,
    title: typeof raw.title === 'string' ? raw.title : undefined,
    description:
      typeof raw.description === 'string' ? raw.description : undefined,
    content: typeof raw.content === 'string' ? raw.content : undefined,
    category: typeof raw.category === 'string' ? raw.category : undefined,
    budget: typeof raw.budget === 'number' ? raw.budget : undefined,
    attachmentIds: Array.isArray(raw.attachmentIds) ? raw.attachmentIds : [],
    collaborationDocId:
      typeof raw.collaborationDocId === 'string'
        ? raw.collaborationDocId
        : undefined,
  };
}
