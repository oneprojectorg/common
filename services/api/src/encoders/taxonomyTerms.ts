import { taxonomyTerms } from '@op/db/schema';
import { createSelectSchema } from 'drizzle-zod';

export const taxonomyTermsEncoder = createSelectSchema(taxonomyTerms)
  .pick({
    id: true,
    taxonomyId: true,
    termUri: true,
    label: true,
    data: true,
    definition: true,
  });
