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
    id: z.string().uuid(),
    label: z.string(),
  });

export const taxonomyTermsWithChildrenEncoder: z.ZodType<any> =
  taxonomyTermsEncoder.extend({
    children: z.lazy(() => z.array(taxonomyTermsWithChildrenEncoder)),
  });
