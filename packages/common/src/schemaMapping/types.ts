import type { z } from 'zod';

import type {
  mappingRuleSchema,
  mappingValueSchema,
  schemaRefSchema,
} from './schema';

export type SchemaRef = z.infer<typeof schemaRefSchema>;

export type MappingValue = z.infer<typeof mappingValueSchema>;

export type MappingExpression =
  | { pointer: string }
  | { value: MappingValue }
  | {
      operator: 'add' | 'subtract' | 'multiply' | 'divide';
      operands: MappingExpression[];
    }
  | {
      function: 'sum' | 'concat' | 'coalesce' | 'round';
      arguments: MappingExpression[];
    };

export type MappingRule = z.infer<typeof mappingRuleSchema>;

export type MappingInput = {
  schema: SchemaRef;
  id: string;
  data: unknown;
};

export type MappingCandidate = {
  value: unknown;
  sourceId: string;
};

export type MappingResult = {
  data: Record<string, unknown>;
  candidates: Record<string, MappingCandidate[]>;
};
