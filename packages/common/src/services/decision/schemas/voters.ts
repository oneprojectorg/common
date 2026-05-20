import { z } from 'zod';

/** Minimal voter profile shape returned to process admins. */
export const voterSchema = z.object({
  slug: z.string(),
  name: z.string().nullable(),
  avatarImage: z
    .object({
      name: z.string(),
    })
    .nullable(),
});

export type Voter = z.infer<typeof voterSchema>;

export const votersListSchema = z.object({
  voters: z.array(voterSchema),
});

export type VotersList = z.infer<typeof votersListSchema>;
