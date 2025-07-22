import { individuals } from '@op/db/schema';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

export const individualsEncoder = createSelectSchema(individuals).pick({
  id: true,
  profileId: true,
});

export const individualsTermsEncoder = z.record(
  z.string(),
  z.array(
    z.object({
      termUri: z.string(),
      taxonomyUri: z.string(),
      id: z.string(),
      label: z.string(),
      facet: z.string().nullish(),
    }),
  ),
);

export type Individual = z.infer<typeof individualsEncoder>;
export type IndividualTerms = z.infer<typeof individualsTermsEncoder>;
