import { isDeepStrictEqual } from 'node:util';

import { evaluateExpression } from '../services/decision/selectionPipeline/expressionEvaluator';
import { isEmptyValue, readOwnField } from './fieldPath';
import { resolveMoneySum } from './moneySum';
import type {
  FieldMapping,
  MappingInput,
  MappingResult,
  SchemaMapping,
  SchemaRef,
} from './schema';

/**
 * Maps each field of each mapping from each input of the mapping's source
 * schema. A target field is filled only when all its values are equal, and
 * never when a `moneySum` rule for it gives no total.
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
  const blockedFields = new Set<string>();
  const sourceIds = [...new Set(inputs.map((input) => input.sourceId))];

  for (const mapping of mappings) {
    if (!isSameSchemaRef({ left: mapping.to, right: targetSchema })) {
      continue;
    }
    const sources = inputs.filter((input) =>
      isSameSchemaRef({ left: input.schema, right: mapping.from }),
    );

    for (const field of mapping.fields) {
      const values = getFieldValues({ field, sources, sourceIds });
      if (values === 'blocked') {
        blockedFields.add(field.to);
        continue;
      }
      if (values.length === 0) {
        continue;
      }
      valuesByField.set(field.to, [
        ...(valuesByField.get(field.to) ?? []),
        ...values,
      ]);
    }
  }

  // Object.fromEntries defines own keys, so a `__proto__` key from a mapping
  // that skipped validation cannot change the prototype.
  const data = Object.fromEntries(
    [...valuesByField].flatMap<[string, unknown]>(
      ([field, [first, ...rest]]) =>
        !blockedFields.has(field) &&
        rest.every((value) => isDeepStrictEqual(first, value))
          ? [[field, structuredClone(first)]]
          : [],
    ),
  );

  return { data };
};

/** `blocked` when a `moneySum` rule gives no total. */
const getFieldValues = ({
  field,
  sources,
  sourceIds,
}: {
  field: FieldMapping;
  sources: MappingInput[];
  sourceIds: string[];
}): unknown[] | 'blocked' => {
  if (typeof field.from !== 'string') {
    const total = resolveMoneySum({
      rule: field.from,
      inputs: sources,
      sourceIds,
    });
    return total ? [total] : 'blocked';
  }
  const path = field.from;
  return sources.flatMap((source) => {
    const value = evaluateSourceField({ data: source.data, path });
    return value === undefined ? [] : [value];
  });
};

const isSameSchemaRef = ({
  left,
  right,
}: {
  left: SchemaRef;
  right: SchemaRef;
}): boolean => left.type === right.type && left.phaseId === right.phaseId;

const evaluateSourceField = ({
  data,
  path,
}: {
  data: unknown;
  path: string;
}): unknown => {
  // The evaluator also reads inherited properties, and gives null for a
  // missing field.
  if (isEmptyValue(readOwnField({ data, path }))) {
    return undefined;
  }
  const value: unknown = evaluateExpression(
    { field: path },
    { record: data, variables: {}, outputs: {} },
  );
  return isEmptyValue(value) ? undefined : value;
};
