import { z } from 'zod';

import type { MappingExpression } from './types';

export const MAX_MAPPING_EXPRESSION_DEPTH = 8;
export const MAX_MAPPING_EXPRESSION_ARGUMENTS = 16;

export const MAPPING_OPERATORS = ['add'] as const;

const FORBIDDEN_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);

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
    { message: 'Must be a dot path of non-empty keys with no prototype keys' },
  );

export const mappingLiteralSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
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
): z.ZodType<MappingExpression> {
  const fieldNode = z.strictObject({ field: fieldPathSchema });
  const literalNode = z.strictObject({ value: mappingLiteralSchema });

  if (remainingDepth <= 1) {
    return z.union([fieldNode, literalNode]);
  }

  const child = buildMappingExpressionSchema(remainingDepth - 1);

  return z.union([
    fieldNode,
    literalNode,
    z.strictObject({
      operator: z.enum(MAPPING_OPERATORS),
      operands: z.array(child).min(2).max(MAX_MAPPING_EXPRESSION_ARGUMENTS),
    }),
  ]);
}
