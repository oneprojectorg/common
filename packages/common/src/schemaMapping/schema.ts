import { z } from 'zod';

import { parseJsonPointer } from './jsonPointer';
import type { MappingExpression } from './types';

export const MAX_MAPPING_EXPRESSION_DEPTH = 8;
export const MAX_MAPPING_EXPRESSION_ARGUMENTS = 16;

export const schemaRefSchema = z.strictObject({
  type: z.enum(['proposal', 'review']),
  phaseId: z.string().min(1),
});

export const jsonPointerSchema = z
  .string()
  .refine((pointer) => parseJsonPointer(pointer) !== undefined, {
    message:
      'Must be a JSON Pointer that is empty or starts with "/", with valid escapes and no prototype keys',
  });

export const targetPointerSchema = jsonPointerSchema.refine(
  (pointer) => pointer !== '',
  { message: 'A target pointer must name a field' },
);

export const mappingValueSchema = z.union([
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
  targetPointer: targetPointerSchema,
  value: mappingExpressionSchema,
});

// Each level only accepts children from the level below, so a payload deeper
// than the cap fails during parsing instead of recursing without a bound.
function buildMappingExpressionSchema(
  remainingDepth: number,
): z.ZodType<MappingExpression> {
  const pointerNode = z.strictObject({ pointer: jsonPointerSchema });
  const valueNode = z.strictObject({ value: mappingValueSchema });

  if (remainingDepth <= 1) {
    return z.union([pointerNode, valueNode]);
  }

  const child = buildMappingExpressionSchema(remainingDepth - 1);
  const children = z.array(child).min(1).max(MAX_MAPPING_EXPRESSION_ARGUMENTS);

  return z.union([
    pointerNode,
    valueNode,
    z.strictObject({
      operator: z.enum(['add', 'subtract', 'multiply', 'divide']),
      operands: children.min(2),
    }),
    z.strictObject({
      function: z.enum(['sum', 'concat', 'coalesce']),
      arguments: children,
    }),
    z.strictObject({
      function: z.literal('round'),
      arguments: z.array(child).length(1),
    }),
  ]);
}
