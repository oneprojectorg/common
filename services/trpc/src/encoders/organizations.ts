import { createSelectSchema } from 'drizzle-zod';

import { organizations } from '@op/db/schema';

import { z } from 'zod';
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
  });

export type Organization = z.infer<typeof organizationsEncoder>;
