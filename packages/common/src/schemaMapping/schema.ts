import { z } from 'zod';

const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

// Temporary: a schema is named by its type and phase, because rubrics and
// the instance template have no stable ID yet. Change this to a form schema
// ID (ADR 0019) before mappings are stored.
export const schemaRefSchema = z.strictObject({
  type: z.enum(['proposal', 'review']),
  phaseId: z.string().min(1),
});

export type SchemaRef = z.infer<typeof schemaRefSchema>;

export const fieldPathSchema = z
  .string()
  .refine(
    (path) =>
      path
        .split('.')
        .every((segment) => segment !== '' && !FORBIDDEN_KEYS.has(segment)),
    { message: 'Must be a dot path of non-empty keys with no prototype keys' },
  );

export const targetKeySchema = z
  .string()
  .refine(
    (key) => key !== '' && !key.includes('.') && !FORBIDDEN_KEYS.has(key),
    { message: 'Must be one non-empty key with no dot and no prototype key' },
  );

/** The total of the money fields at these paths (ADR 0022, amended 2026-11-23). */
const moneySumSchema = z.strictObject({
  moneySum: z.array(fieldPathSchema).min(1),
});

export type MoneySum = z.infer<typeof moneySumSchema>;

export const fieldMappingSchema = z.strictObject({
  from: z.union([fieldPathSchema, moneySumSchema]),
  to: targetKeySchema,
});

export type FieldMapping = z.infer<typeof fieldMappingSchema>;

export const schemaMappingSchema = z.strictObject({
  from: schemaRefSchema,
  to: schemaRefSchema,
  fields: z.array(fieldMappingSchema).min(1),
});

export type SchemaMapping = z.infer<typeof schemaMappingSchema>;

export type MappingInput = {
  schema: SchemaRef;
  data: unknown;
  /** The source the input belongs to: a proposal is its own, a review its proposal's. */
  sourceId: string;
};

export type MappingResult = {
  data: Record<string, unknown>;
};
