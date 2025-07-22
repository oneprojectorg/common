import { individuals } from '@op/db/schema';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

import { entityTermsEncoder } from './shared';

export const individualsEncoder = createSelectSchema(individuals).pick({
  id: true,
  profileId: true,
});

export const individualsTermsEncoder = entityTermsEncoder;

export type Individual = z.infer<typeof individualsEncoder>;
export type IndividualTerms = z.infer<typeof individualsTermsEncoder>;
