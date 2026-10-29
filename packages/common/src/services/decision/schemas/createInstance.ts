import { z } from 'zod';

import { MAX_PHASES_PER_DECISION } from '../utils/phaseOrder';
import { phaseNameInputSchema } from './phaseName';

export const PROCESS_NAME_MIN_LENGTH = 3;
export const PROCESS_NAME_MAX_LENGTH = 256;

export const PHASE_KINDS = [
  'submissions',
  'review',
  'voting',
  'results',
] as const;

export type PhaseKind = (typeof PHASE_KINDS)[number];

export const PROCESS_TYPES = ['grant', 'pb', 'other'] as const;

export type ProcessType = (typeof PROCESS_TYPES)[number];

export const instancePhaseInputSchema = z.object({
  kind: z.enum(PHASE_KINDS),
  /** Already in the creator's language. */
  name: phaseNameInputSchema,
});

export type InstancePhaseInput = z.infer<typeof instancePhaseInputSchema>;

export const createInstanceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(PROCESS_NAME_MIN_LENGTH)
    .max(PROCESS_NAME_MAX_LENGTH),
  type: z.enum(PROCESS_TYPES),
  phases: z.array(instancePhaseInputSchema).max(MAX_PHASES_PER_DECISION),
});

export type CreateInstanceInput = z.infer<typeof createInstanceSchema>;
