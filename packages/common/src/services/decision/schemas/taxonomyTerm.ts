import { z } from 'zod';

import { taxonomyTermsEncoder } from '../../terms/schemas';

export const taxonomyTermSchema = taxonomyTermsEncoder.pick({
  id: true,
  label: true,
  termUri: true,
});

export type TaxonomyTerm = z.infer<typeof taxonomyTermSchema>;
