import { taxonomyTerms } from '@op/db/schema';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

export const taxonomyTermSchema = createSelectSchema(taxonomyTerms)
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
    termUri: z.string(),
  });

export const taxonomyTermWithChildrenSchema: z.ZodType<any> =
  taxonomyTermSchema.extend({
    children: z.lazy(() => z.array(taxonomyTermWithChildrenSchema)),
  });
