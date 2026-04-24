import { ProcessStatus } from '@op/db/schema';
import { z } from 'zod';

const adminDecisionCurrentPhaseSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  endDate: z.string().nullable(),
});

export const adminDecisionInstanceSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(ProcessStatus).nullable(),
  createdAt: z.string().nullable(),
  currentPhase: adminDecisionCurrentPhaseSchema.nullable(),
  stewardName: z.string().nullable(),
  proposalCount: z.number(),
  participantCount: z.number(),
  instanceData: z.unknown(),
});

export type AdminDecisionInstance = z.infer<typeof adminDecisionInstanceSchema>;
