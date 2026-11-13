import { isDeepStrictEqual } from 'node:util';

import { readOwnField } from './fieldPath';
import type {
  MappingInput,
  MappingResult,
  SchemaMapping,
  SchemaRef,
} from './schema';

/**
 * Copies each field of each mapping from each input of the mapping's source
 * schema. A target field is filled only when all its values are equal.
 */
export const mapToSchema = ({
  mappings,
  inputs,
  targetSchema,
}: {
  mappings: SchemaMapping[];
  inputs: MappingInput[];
  targetSchema: SchemaRef;
}): MappingResult => {
  const valuesByField = new Map<string, unknown[]>();

  for (const mapping of mappings) {
    if (!isSameSchemaRef({ left: mapping.to, right: targetSchema })) {
      continue;
    }
    const sources = inputs.filter((input) =>
      isSameSchemaRef({ left: input.schema, right: mapping.from }),
    );

    for (const field of mapping.fields) {
      for (const source of sources) {
        const value = readOwnField({ data: source.data, path: field.from });
        if (isEmptyValue(value)) {
          continue;
        }
        const values = valuesByField.get(field.to) ?? [];
        values.push(value);
        valuesByField.set(field.to, values);
      }
    }
  }

  // Object.fromEntries defines own keys, so a `__proto__` key from a mapping
  // that skipped validation cannot change the prototype.
  const data = Object.fromEntries(
    [...valuesByField].flatMap<[string, unknown]>(([field, [first, ...rest]]) =>
      rest.every((value) => isDeepStrictEqual(first, value))
        ? [[field, structuredClone(first)]]
        : [],
    ),
  );

  return { data };
};

export const isSameSchemaRef = ({
  left,
  right,
}: {
  left: SchemaRef;
  right: SchemaRef;
}): boolean => left.type === right.type && left.phaseId === right.phaseId;

const isEmptyValue = (value: unknown): boolean =>
  value === undefined || value === null || value === '';
