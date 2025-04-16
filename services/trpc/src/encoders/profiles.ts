import { createSelectSchema } from 'drizzle-zod';

import { profiles } from '@op/db/schema';

export const profilesEncoder = createSelectSchema(profiles);
