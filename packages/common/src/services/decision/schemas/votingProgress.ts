import { z } from 'zod';

import { instancePhaseRefSchema } from './instance';

export const votingProgressInputSchema = instancePhaseRefSchema.pick({
  processInstanceId: true,
});

/**
 * Turnout counts the instance's vote submissions against the members who can
 * vote now. daysLeft is for the current phase; null without an end date.
 */
export const votingProgressSchema = z.object({
  participantsVotedCount: z.number().int(),
  participantsEligibleCount: z.number().int(),
  turnoutPercentage: z.number().int(),
  daysLeft: z.number().int().nullable(),
});

export type VotingProgress = z.infer<typeof votingProgressSchema>;
