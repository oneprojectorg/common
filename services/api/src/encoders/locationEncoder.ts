import { locations } from '@op/db/schema';
import { createSelectSchema } from 'drizzle-zod';

export const locationEncoder = createSelectSchema(locations)
  .pick({
    id: true,
    name: true,
    placeId: true,
    countryCode: true,
    countryName: true,
    metadata: true,
  })
  .transform((data) => {
    return {
      ...data,
      data: data.metadata,
    };
  });
