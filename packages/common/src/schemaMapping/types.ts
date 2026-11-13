import type { z } from 'zod';

import type {
  MAPPING_OPERATORS,
  mappingLiteralSchema,
  mappingRuleSchema,
  schemaRefSchema,
} from './schema';

export type SchemaRef = z.infer<typeof schemaRefSchema>;

// A subset of the selection pipeline's Expression, so the pipeline evaluator
// can run it.
export type MappingExpression =
  | { field: string }
  | { value: z.infer<typeof mappingLiteralSchema> }
  | {
      operator: (typeof MAPPING_OPERATORS)[number];
      operands: MappingExpression[];
    };

export type MappingRule = z.infer<typeof mappingRuleSchema>;

export type MappingInput = {
  schema: SchemaRef;
  data: unknown;
};

export type MappingResult = {
  data: Record<string, unknown>;
};
