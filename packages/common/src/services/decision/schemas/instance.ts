import { z } from 'zod';

/**
 * Reference to a specific phase within a process instance.
 */
export const instancePhaseRefSchema = z.object({
  processInstanceId: z.uuid(),
  phaseId: z.string(),
});

export type InstancePhaseRef = z.infer<typeof instancePhaseRefSchema>;

/**
 * Reference to a specific proposal scoped to an instance phase.
 */
export const proposalPhaseRefSchema = instancePhaseRefSchema.extend({
  proposalId: z.uuid(),
});

export type ProposalPhaseRef = z.infer<typeof proposalPhaseRefSchema>;
