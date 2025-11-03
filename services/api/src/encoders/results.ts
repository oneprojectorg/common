import { z } from 'zod';

import { dbFilter } from '../utils';

export const getInstanceResultsInputSchema = dbFilter
  .extend({
    instanceId: z.uuid(),
  })
  .optional();

export const getResultsStatsInputSchema = z.object({
  instanceId: z.uuid(),
});

export const resultsStatsEncoder = z.object({
  membersVoted: z.number(),
  proposalsFunded: z.number(),
  totalAllocated: z.number(),
});
