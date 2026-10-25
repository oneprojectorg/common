import { z } from 'zod';

import { instancePhaseRefSchema } from './instance';

export const votingProgressInputSchema = instancePhaseRefSchema.pick({
  processInstanceId: true,
});

/**
 * Turnout for the instance's current phase.
 *   - participantsEligibleCount: members whose role can vote (VOTE or ADMIN).
 *   - participantsVotedCount: eligible members with a vote submission.
 *   - turnoutPercentage: voted / eligible, rounded; 0 when nobody is eligible.
 *   - daysLeft: ceil(now → phase endDate); null if no end date or phase.
 */
export const votingProgressSchema = z.object({
  participantsVotedCount: z.number().int(),
  participantsEligibleCount: z.number().int(),
  turnoutPercentage: z.number().int(),
  daysLeft: z.number().int().nullable(),
});

export type VotingProgress = z.infer<typeof votingProgressSchema>;
