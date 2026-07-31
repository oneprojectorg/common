import { z } from 'zod';

/**
 * Reference to a specific phase within a process instance.
 */
export const instancePhaseRefSchema = z.object({
  processInstanceId: z.uuid(),
  phaseId: z.string().min(1),
});

export type InstancePhaseRef = z.infer<typeof instancePhaseRefSchema>;

/**
 * Same reference with the phase optional — for queries where no phase means
 * instance-wide. '' stays rejected so it can't collide with a NULL phase key.
 */
export const instanceOptionalPhaseRefSchema = instancePhaseRefSchema.partial({
  phaseId: true,
});

export type InstanceOptionalPhaseRef = z.infer<
  typeof instanceOptionalPhaseRefSchema
>;
