import { logger } from '@op/logging';
import { z } from 'zod';

import { type SchemaMapping, schemaMappingSchema } from '../../schemaMapping';
import type { PhaseInstanceData } from './schemas/instanceData';

const developPrefillMappingsSchema = z.array(schemaMappingSchema);

/**
 * The mappings that fill a proposal developed in `phase` from its sources.
 * This is the one place that knows where they are stored: ADR 0021 leaves
 * that open, so for now they sit on the phase in the instance data.
 *
 * No mappings gives an empty list. Mappings that fail validation are logged
 * and give an empty list, so a bad config never blocks a create.
 */
export function getDevelopPrefillMappings(
  phase: PhaseInstanceData,
): SchemaMapping[] {
  if (phase.developPrefillMappings === undefined) {
    return [];
  }

  const result = developPrefillMappingsSchema.safeParse(
    phase.developPrefillMappings,
  );
  if (!result.success) {
    logger.error('Ignoring invalid develop prefill mappings', {
      phaseId: phase.phaseId,
      error: result.error,
    });
    return [];
  }

  return result.data;
}
