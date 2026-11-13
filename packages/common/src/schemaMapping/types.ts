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
  | 'modulo'
  | 'power'
  | 'sum'
  | 'avg'
  | 'min'
  | 'max'
  | 'abs'
  | 'round'
  | 'floor'
  | 'ceil';

export type MappingRuleProblem =
  | { code: 'unknownSourceSchema'; ruleIndex: number; schema: SchemaRef }
  | { code: 'unknownTargetSchema'; ruleIndex: number; schema: SchemaRef }
  | { code: 'sourceFieldNotFound'; ruleIndex: number; field: string }
  | { code: 'targetFieldNotFound'; ruleIndex: number; field: string }
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
