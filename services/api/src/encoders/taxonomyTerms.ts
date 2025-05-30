import { taxonomyTerms } from '@op/db/schema';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

export const taxonomyTermsEncoder = createSelectSchema(taxonomyTerms)
  .pick({
    id: true,
    taxonomyId: true,
    termUri: true,
    label: true,
    data: true,
    definition: true,
  })
  .extend({
    id: z.string(),
    taxonomyId: z.string(),
    termUri: z.string().optional(),
    label: z.string(),
    data: z.object({}).optional(),
  });
