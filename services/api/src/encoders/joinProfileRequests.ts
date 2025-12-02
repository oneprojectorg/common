import { joinProfileRequests } from '@op/db/schema';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

import { baseProfileEncoder } from './profiles';

export const joinProfileRequestEncoder = createSelectSchema(joinProfileRequests)
  .pick({
    status: true,
  })
  .extend({
    requestProfile: baseProfileEncoder,
    targetProfile: baseProfileEncoder,
  });

export type JoinProfileRequestResponse = z.infer<
  typeof joinProfileRequestEncoder
>;
