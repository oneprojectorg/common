import { createSelectSchema } from 'drizzle-zod';

import { organizations } from '@op/db/schema';

import type { z } from 'zod';

export const organizationsEncoder = createSelectSchema(organizations).pick({
  id: true,
  name: true,
  city: true,
  state: true,
  description: true,
  mission: true,
  isOfferingFunds: true,
  isReceivingFunds: true,
});

export type Organization = z.infer<typeof organizationsEncoder>;
