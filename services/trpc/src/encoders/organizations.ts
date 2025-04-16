import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

import { organizations } from '@op/db/schema';

import { fundingLinksEncoder } from './fundingLinks';
import { projectEncoder } from './projects';

export const organizationsEncoder = createSelectSchema(organizations)
  .pick({
    id: true,
    name: true,
    city: true,
    state: true,
    description: true,
    mission: true,
    isOfferingFunds: true,
    isReceivingFunds: true,
  })
  .extend({
    projects: z.array(projectEncoder),
    fundingLinks: z.array(fundingLinksEncoder),
  });

export type Organization = z.infer<typeof organizationsEncoder>;
