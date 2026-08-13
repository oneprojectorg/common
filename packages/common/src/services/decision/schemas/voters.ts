import { z } from 'zod';

import {
  PARTICIPANT_FACE_PILE_MAX,
  participantProfileSchema,
} from './participantProfile';

export const voterSchema = participantProfileSchema;

export type Voter = z.infer<typeof voterSchema>;

export const votersListSchema = z.object({
  /** Capped face-pile sample, earliest voters first. */
  voters: z.array(voterSchema).max(PARTICIPANT_FACE_PILE_MAX),
  /** Every voter in the instance, not just the ones in `voters`. */
  total: z.number(),
});

export type VotersList = z.infer<typeof votersListSchema>;
