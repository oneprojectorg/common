import { createSelectSchema } from 'drizzle-zod';

import { organizations } from '@op/db/schema';

export const organizationsEncoder = createSelectSchema(organizations)
  .pick({
    id: true,
    name: true,
  })
  .nullish();
