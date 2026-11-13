import type { z } from 'zod';

import type {
  fieldMappingSchema,
  schemaMappingSchema,
  schemaRefSchema,
} from './schema';

export type SchemaRef = z.infer<typeof schemaRefSchema>;

export type FieldMapping = z.infer<typeof fieldMappingSchema>;

export type SchemaMapping = z.infer<typeof schemaMappingSchema>;

export type MappingInput = {
  schema: SchemaRef;
  data: unknown;
};

export type MappingResult = {
  data: Record<string, unknown>;
};
