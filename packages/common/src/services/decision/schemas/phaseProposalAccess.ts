import { z } from 'zod';

import { instancePhaseRefSchema } from './instance';

export const phaseProposalAccessInputSchema = instancePhaseRefSchema.pick({
  processInstanceId: true,
});

/**
 * What the caller may do with proposals in the current phase. Both can be
 * true: a phase can allow ordinary and developed proposals at once.
 */
export const phaseProposalAccessSchema = z.object({
  canSubmit: z.boolean(),
  canDevelop: z.boolean(),
});

export type PhaseProposalAccess = z.infer<typeof phaseProposalAccessSchema>;
