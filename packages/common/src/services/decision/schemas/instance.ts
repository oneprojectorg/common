import { z } from 'zod';

/**
 * Reference to a process instance, optionally narrowed to a specific
 * phase. When `phaseId` is omitted, callers should default to the
 * instance's current phase.
 */
export const instancePhaseRefSchema = z.object({
  processInstanceId: z.uuid(),
  phaseId: z.string().optional(),
});

export type InstancePhaseRef = z.infer<typeof instancePhaseRefSchema>;
