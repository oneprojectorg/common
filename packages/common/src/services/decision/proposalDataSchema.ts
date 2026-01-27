import { z } from 'zod';

/**
 * Zod schema for proposal data with known fields.
 * Uses looseObject to allow additional fields from custom proposal templates.
 * Handles backward compatibility where 'content' maps to 'description'.
 */
export const proposalDataSchema = z
  .looseObject({
    title: z.string().nullish(),
    description: z.string().nullish(),
    content: z.string().nullish(), // backward compatibility
    category: z.string().nullish(),
    budget: z.union([z.string(), z.number()]).pipe(z.coerce.number()).nullish(),
    attachmentIds: z
      .array(z.string())
      .nullish()
      .transform((v) => v ?? []),
    collaborationDocId: z.string().nullish(),
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
    title: (raw.title as string) ?? undefined,
    description: (raw.description as string) ?? undefined,
    content: (raw.content as string) ?? undefined,
    category: (raw.category as string) ?? undefined,
    budget: (raw.budget as number) ?? undefined,
    attachmentIds: (raw.attachmentIds as string[]) ?? [],
    collaborationDocId: (raw.collaborationDocId as string) ?? undefined,
  };
}
