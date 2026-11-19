import { z } from 'zod';

export const processCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  termUri: z.string(),
});

export type ProcessCategory = z.infer<typeof processCategorySchema>;
