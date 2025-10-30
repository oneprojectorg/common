import { z } from 'zod';

import { dbFilter } from '../utils';

export const getInstanceResultsInputSchema = dbFilter
  .extend({
    instanceId: z.uuid(),
  })
  .optional();
