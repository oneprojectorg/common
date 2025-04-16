import { createSelectSchema } from 'drizzle-zod';

import { links } from '@op/db/schema';

export const linksEncoder = createSelectSchema(links);
