import { z } from 'zod';

import type {
  Block,
  Expression,
  ScoringCriteria,
  SelectionPipeline,
} from './types';

// Strict objects throughout: the evaluator tells expressions apart by which
// keys are present, so an extra key changes what an expression means.

const comparisonOperators = [
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

const arithmeticOperators = [
  'add',
  'subtract',
  'multiply',
  'divide',
  'modulo',
  'power',
] as const;

export const expressionSchema: z.ZodType<Expression, Expression> = z.lazy(() =>
  z.union([
    z.strictObject({ field: z.string().min(1) }),
    z.strictObject({
      operator: z.enum(comparisonOperators),
      left: expressionSchema,
      right: expressionSchema,
    }),
    z
      .strictObject({
        and: z.array(expressionSchema).optional(),
        or: z.array(expressionSchema).optional(),
        not: expressionSchema.optional(),
      })
      .refine(
        (expression) =>
          expression.and !== undefined ||
          expression.or !== undefined ||
          expression.not !== undefined,
        'A logical expression needs and, or or not',
      ),
    z.strictObject({
      operator: z.enum(arithmeticOperators),
      operands: z.array(expressionSchema),
    }),
    z.strictObject({
      function: z.string().min(1),
      arguments: z.array(expressionSchema),
    }),
    z
      .strictObject({ value: z.unknown() })
      .refine(
        (expression) => expression.value !== undefined,
        'A literal needs a value',
      ),
    z.strictObject({ variable: z.string().min(1) }),
  ]),
);

const scoringCriteriaSchema: z.ZodType<ScoringCriteria, ScoringCriteria> =
  z.strictObject({
    field: z.union([z.string(), expressionSchema]).optional(),
    expression: expressionSchema.optional(),
    weight: z.number(),
    normalize: z.boolean().optional(),
    invert: z.boolean().optional(),
  });

const blockBase = {
  id: z.string().min(1),
  name: z.string().optional(),
  description: z.string().optional(),
  input: z.string().optional(),
  output: z.string().optional(),
};

const numberOrExpression = z.union([z.number(), expressionSchema]);

export const blockSchema: z.ZodType<Block, Block> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.strictObject({
      ...blockBase,
      type: z.literal('filter'),
      condition: expressionSchema,
    }),
    z.strictObject({
      ...blockBase,
      type: z.literal('transform'),
      transformations: z.record(z.string(), expressionSchema),
    }),
    z.strictObject({
      ...blockBase,
      type: z.literal('compute'),
      computations: z.record(z.string(), expressionSchema),
    }),
    z.strictObject({
      ...blockBase,
      type: z.literal('branch'),
      branches: z.array(
        z.strictObject({
          condition: expressionSchema,
          blocks: z.array(blockSchema),
          output: z.string().optional(),
        }),
      ),
      default: z
        .strictObject({
          blocks: z.array(blockSchema),
          output: z.string().optional(),
        })
        .optional(),
    }),
    z.strictObject({
      ...blockBase,
      type: z.literal('merge'),
      inputs: z.array(z.string()),
      strategy: z.enum(['union', 'intersection', 'concat', 'custom']),
      customMerge: expressionSchema.optional(),
    }),
    z.strictObject({
      ...blockBase,
      type: z.literal('group'),
      groupBy: z.union([z.string(), expressionSchema]),
      aggregations: z
        .record(
          z.string(),
          z.strictObject({
            operation: z.enum(['count', 'sum', 'avg', 'min', 'max']),
            field: z.string().optional(),
          }),
        )
        .optional(),
    }),
    z.strictObject({
      ...blockBase,
      type: z.literal('limit'),
      count: numberOrExpression,
      offset: numberOrExpression.optional(),
    }),
    z.strictObject({
      ...blockBase,
      type: z.literal('sort'),
      sortBy: z.array(
        z.strictObject({
          field: z.union([z.string(), expressionSchema]),
          order: z.enum(['asc', 'desc']),
          nullsFirst: z.boolean().optional(),
        }),
      ),
    }),
    z.strictObject({
      ...blockBase,
      type: z.literal('score'),
      scoreField: z.string().min(1),
      formula: z.union([expressionSchema, z.array(scoringCriteriaSchema)]),
    }),
    z.strictObject({
      ...blockBase,
      type: z.literal('debug'),
      message: z.string().optional(),
      logFields: z.array(z.string()).optional(),
    }),
  ]),
);

/** A pipeline as a client may write it; the read-side encoders stay lenient. */
export const selectionPipelineSchema: z.ZodType<
  SelectionPipeline,
  SelectionPipeline
> = z.strictObject({
  version: z.string().min(1),
  blocks: z.array(blockSchema),
  output: z.string().optional(),
  variables: z.record(z.string(), z.unknown()).optional(),
});
