import { locations } from '@op/db/schema';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

export const locationEncoder = createSelectSchema(locations)
  .pick({
    id: true,
    name: true,
    placeId: true,
    countryCode: true,
    countryName: true,
    metadata: true,
  })
  .strip()
  .extend({
    id: z.string().optional(),
    metadata: z.record(z.string(), z.any()).optional(),
  });
