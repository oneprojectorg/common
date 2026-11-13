import { z } from 'zod';

import type { Expression } from '../services/decision/selectionPipeline/types';

export const MAX_MAPPING_EXPRESSION_DEPTH = 8;
export const MAX_MAPPING_EXPRESSION_ARGUMENTS = 16;

const FORBIDDEN_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);

const COMPARISON_OPERATORS = [
  'equals',
  'notEquals',
  'greaterThan',
  'lessThan',
  'greaterThanOrEquals',
  'lessThanOrEquals',
  'in',
  'notIn',
  'contains',
  'startsWith',
  'endsWith',
  'matches',
] as const;

const ARITHMETIC_OPERATORS = [
  'add',
  'subtract',
  'multiply',
  'divide',
  'modulo',
  'power',
] as const;

// The functions the selection pipeline's evaluator knows, except `if`, which
// needs exactly three arguments. The evaluator throws on any other name.
const FUNCTIONS = [
  'sum',
  'avg',
  'count',
  'min',
  'max',
  'coalesce',
  'concat',
  'length',
  'abs',
  'round',
  'floor',
  'ceil',
  'toLowerCase',
  'toUpperCase',
  'trim',
] as const;

export const schemaRefSchema = z.strictObject({
  type: z.enum(['proposal', 'review']),
  phaseId: z.string().min(1),
});

export const fieldPathSchema = z
  .string()
  .refine(
    (path) =>
      path
        .split('.')
        .every((segment) => segment !== '' && !FORBIDDEN_SEGMENTS.has(segment)),
    {
      message: 'Must be a dot path of non-empty keys with no prototype keys',
    },
  );

const scalarSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const mappingLiteralSchema = z.union([
  scalarSchema,
  z.array(scalarSchema).max(MAX_MAPPING_EXPRESSION_ARGUMENTS),
]);

export const mappingExpressionSchema = buildMappingExpressionSchema(
  MAX_MAPPING_EXPRESSION_DEPTH,
);

export const mappingRuleSchema = z.strictObject({
  sourceSchema: schemaRefSchema,
  targetSchema: schemaRefSchema,
  targetField: fieldPathSchema,
  value: mappingExpressionSchema,
});

// Each level only accepts children from the level below, so a payload deeper
// than the cap fails during parsing instead of recursing without a bound.
function buildMappingExpressionSchema(
  remainingDepth: number,
): z.ZodType<Expression> {
  const fieldNode = z.strictObject({ field: fieldPathSchema });
  const literalNode = z.strictObject({ value: mappingLiteralSchema });

  if (remainingDepth <= 1) {
    return z.union([fieldNode, literalNode]);
  }

  const child = buildMappingExpressionSchema(remainingDepth - 1);
  const children = z.array(child).min(1).max(MAX_MAPPING_EXPRESSION_ARGUMENTS);

  return z.union([
    fieldNode,
    literalNode,
    z.strictObject({
      operator: z.enum(COMPARISON_OPERATORS),
      left: child,
      right: child,
    }),
    z.strictObject({ and: children }),
    z.strictObject({ or: children }),
    z.strictObject({ not: child }),
    z.strictObject({
      operator: z.enum(ARITHMETIC_OPERATORS),
      operands: children.min(2),
    }),
    z.strictObject({
      function: z.enum(FUNCTIONS),
      arguments: children,
    }),
    z.strictObject({
      function: z.literal('if'),
      arguments: z.array(child).length(3),
    }),
  ]);
}
