import { taxonomyTerms } from '@op/db/schema';
import { createSelectSchema } from 'drizzle-zod';

export const taxonomyTermsEncoder = createSelectSchema(taxonomyTerms);
