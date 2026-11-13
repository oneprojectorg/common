import type { z } from 'zod';

import type { mappingRuleSchema, schemaRefSchema } from './schema';

export type SchemaRef = z.infer<typeof schemaRefSchema>;

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

export type SchemaEntry = {
  ref: SchemaRef;
  schema: unknown;
};

export type MappingValueType =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'object'
  | 'array'
  | 'null'
  | 'unknown';

export type MappingTypeDescription = {
  type: MappingValueType;
  format?: string;
};

export type NumericOperation =
  | 'add'
  | 'subtract'
  | 'multiply'
  | 'divide'
  | 'sum'
  | 'round';

export type MappingRuleProblem =
  | { code: 'unknownSourceSchema'; ruleIndex: number; schema: SchemaRef }
  | { code: 'unknownTargetSchema'; ruleIndex: number; schema: SchemaRef }
  | { code: 'sourcePointerNotFound'; ruleIndex: number; pointer: string }
  | { code: 'targetPointerNotFound'; ruleIndex: number; pointer: string }
  | {
      code: 'operandNotNumber';
      ruleIndex: number;
      operation: NumericOperation;
      operandType: MappingTypeDescription;
    }
  | {
      code: 'operandNotText';
      ruleIndex: number;
      operandType: MappingTypeDescription;
    }
  | {
      code: 'typeMismatch';
      ruleIndex: number;
      sourceType: MappingTypeDescription;
      targetType: MappingTypeDescription;
    };
