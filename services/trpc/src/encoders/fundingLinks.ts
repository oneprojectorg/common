import { createSelectSchema } from 'drizzle-zod';

import { fundingLinks } from '@op/db/schema';

export const fundingLinksEncoder = createSelectSchema(fundingLinks);
