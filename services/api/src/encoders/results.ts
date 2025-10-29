import { z } from 'zod';

export const getInstanceResultsInputSchema = z.object({
  instanceId: z.uuid(),
});
