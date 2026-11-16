import { z } from 'zod';

/** A phase's id within its instance's phase list — a slug, not a uuid. */
export const phaseIdSchema = z.string().min(1);

/**
 * Reference to a specific phase within a process instance.
 */
export const instancePhaseRefSchema = z.object({
  processInstanceId: z.uuid(),
  phaseId: phaseIdSchema,
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
