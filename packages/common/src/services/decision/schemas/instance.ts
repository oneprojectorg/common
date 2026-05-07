import { z } from 'zod';

/**
 * Reference to a specific phase within a process instance.
 */
export const instancePhaseRefSchema = z.object({
  processInstanceId: z.uuid(),
  phaseId: z.string(),
});

export type InstancePhaseRef = z.infer<typeof instancePhaseRefSchema>;
