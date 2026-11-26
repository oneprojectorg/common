import { logger } from '@op/logging';
import { z } from 'zod';

import { type SchemaMapping, schemaMappingSchema } from '../../schemaMapping';
import type { PhaseInstanceData } from './schemas/instanceData';
import { getDevelopPrefillLogAttributes } from './utils/developPrefillLog';

const developPrefillMappingsSchema = z.array(schemaMappingSchema);

/**
 * The phase's develop prefill mappings (ADR 0022). Missing or invalid gives
 * `[]`, so a bad config never blocks a create; invalid ones are logged.
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
      ...getDevelopPrefillLogAttributes('invalid_mappings'),
      phaseId: phase.phaseId,
    });
    return [];
  }

  return mappings;
}
