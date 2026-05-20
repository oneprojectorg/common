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
