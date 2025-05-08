import { z } from 'zod';

export const dbFilter = z
  .object({
    limit: z.number().optional(),
  })
  .optional();
