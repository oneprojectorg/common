import { links } from '@op/db/schema';
import { createSelectSchema } from 'drizzle-zod';

export const linksEncoder = createSelectSchema(links);
