import { logger } from '@op/logging';
import { z } from 'zod';

import { type SchemaMapping, schemaMappingSchema } from '../../schemaMapping';
import type { PhaseInstanceData } from './schemas/instanceData';

const developPrefillMappingsSchema = z.array(schemaMappingSchema);

/**
 * The mappings (ADR 0022) that fill a proposal developed in `phase` from its
 * sources. The one place that knows they sit on the phase config.
 *
 * No mappings gives an empty list. Invalid mappings are logged and give an
 * empty list, so a bad config never blocks a create.
 */
export function getDevelopPrefillMappings(
  phase: PhaseInstanceData,
): SchemaMapping[] {
  const mappings = phase.developPrefillMappings;
  if (mappings === undefined) {
    return [];
  }

  if (!developPrefillMappingsSchema.validate(mappings)) {
    logger.error('Ignoring invalid develop prefill mappings', {
      phaseId: phase.phaseId,
    });
    return [];
  }

  return mappings;
}
