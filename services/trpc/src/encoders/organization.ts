import { createSelectSchema } from 'drizzle-zod';

import { organizations } from '@op/db/schema';

export const organizationEncoder = createSelectSchema(organizations)
  .pick({
    id: true,
  })
  .nullish();
