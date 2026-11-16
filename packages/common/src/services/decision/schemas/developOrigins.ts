import { z } from 'zod';

import { paginationInput } from '../../../utils/pagination';
import { phaseIdSchema } from './instance';
import { phaseProposalListSchema, proposalSearchSchema } from './proposal';

export const DEVELOP_ORIGIN_SCOPES = ['all', 'assigned'] as const;

/** An origin is an earlier-phase proposal an entry is, or can be, developed from; `assigned` keeps the caller's review assignments on any of `phaseIds`. */
export const listDevelopOriginsInputSchema = z
  .object({
    processInstanceId: z.uuid(),
    phaseIds: z.array(phaseIdSchema).min(1).max(10),
    scope: z.enum(DEVELOP_ORIGIN_SCOPES).default('all'),
    search: proposalSearchSchema,
    categoryIds: z.array(z.uuid()).max(10).optional(),
  })
  .extend(paginationInput('md').shape);

export type ListDevelopOriginsInput = z.infer<
  typeof listDevelopOriginsInputSchema
>;

export const developOriginListSchema = phaseProposalListSchema;

export type DevelopOriginList = z.infer<typeof developOriginListSchema>;
