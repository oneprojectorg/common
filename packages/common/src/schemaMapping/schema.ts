import { z } from 'zod';

const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

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
        .every((segment) => segment !== '' && !FORBIDDEN_KEYS.has(segment)),
    { message: 'Must be a dot path of non-empty keys with no prototype keys' },
  );

export const targetKeySchema = z
  .string()
  .refine(
    (key) => key !== '' && !key.includes('.') && !FORBIDDEN_KEYS.has(key),
    { message: 'Must be one non-empty key with no dot and no prototype key' },
  );

export const fieldMappingSchema = z.strictObject({
  from: fieldPathSchema,
  to: targetKeySchema,
});

export const schemaMappingSchema = z.strictObject({
  from: schemaRefSchema,
  to: schemaRefSchema,
  fields: z.array(fieldMappingSchema).min(1),
});
