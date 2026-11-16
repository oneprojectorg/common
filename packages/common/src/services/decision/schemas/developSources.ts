import { z } from 'zod';

import { paginationInput } from '../../../utils/pagination';
import { phaseIdSchema } from './instance';
import { phaseProposalListSchema, proposalSearchSchema } from './proposal';

export const DEVELOP_SOURCE_SCOPES = ['all', 'assigned'] as const;

/** An source is an earlier-phase proposal an entry is, or can be, developed from; `assigned` keeps the caller's review assignments on any of `phaseIds`. */
export const listDevelopSourcesInputSchema = z
  .object({
    processInstanceId: z.uuid(),
    phaseIds: z.array(phaseIdSchema).min(1).max(10),
    scope: z.enum(DEVELOP_SOURCE_SCOPES).default('all'),
    search: proposalSearchSchema,
    categoryIds: z.array(z.uuid()).max(10).optional(),
  })
  .extend(paginationInput('md').shape);

export type ListDevelopSourcesInput = z.infer<
  typeof listDevelopSourcesInputSchema
>;

export const developSourceListSchema = phaseProposalListSchema;

export type DevelopSourceList = z.infer<typeof developSourceListSchema>;
