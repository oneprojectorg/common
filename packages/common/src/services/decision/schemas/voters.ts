import { z } from 'zod';

import { participantProfileSchema } from './participantProfile';

export const voterSchema = participantProfileSchema;

export type Voter = z.infer<typeof voterSchema>;

export const votersListSchema = z.object({
  voters: z.array(voterSchema),
});

export type VotersList = z.infer<typeof votersListSchema>;
