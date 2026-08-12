import { z } from 'zod';

/** Minimal profile shape used by face-pile endpoints (voters, submitters, etc). */
export const participantProfileSchema = z.object({
  slug: z.string(),
  name: z.string().nullable(),
  avatarImage: z
    .object({
      name: z.string(),
    })
    .nullable(),
});

export type ParticipantProfile = z.infer<typeof participantProfileSchema>;

// Face-piles render at most 20 avatars, so the sample never needs to exceed
// that. Cap on the server (SQL `.limit()`) and re-assert in the wire schema so
// a regression in either place fails loudly instead of streaming thousands of
// rows to callers (ONE-40 audit #23).
export const PARTICIPANT_FACE_PILE_MAX = 20;
