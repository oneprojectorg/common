import { logger } from '@op/logging';
import { isDeepStrictEqual } from 'node:util';

import { sumAmounts } from '../services/decision/fieldUnit';
import { evaluateExpression } from '../services/decision/selectionPipeline/expressionEvaluator';
import { readOwnField } from './fieldPath';
import type {
  FieldMapping,
  MappingInput,
  MappingResult,
  SchemaMapping,
  SchemaRef,
} from './schema';

// An input whose value cannot be mapped; it leaves the field empty for all inputs.
const BLOCKED = Symbol('blocked');

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
        const value = evaluateRule({ data: source.data, from: field.from });
        if (value === undefined) {
          continue;
        }
        if (value === BLOCKED) {
          logger.warn('A mapping rule read a value that is not a number', {
            targetPhaseId: targetSchema.phaseId,
            field: field.to,
          });
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
    [...valuesByField].flatMap<[string, unknown]>(
      ([field, [first, ...rest]]) =>
        first !== BLOCKED &&
        rest.every((value) => isDeepStrictEqual(first, value))
          ? [[field, structuredClone(first)]]
          : [],
    ),
  );

  return { data };
};

const isSameSchemaRef = ({
  left,
  right,
}: {
  left: SchemaRef;
  right: SchemaRef;
}): boolean => left.type === right.type && left.phaseId === right.phaseId;

const evaluateRule = ({
  data,
  from,
}: {
  data: unknown;
  from: FieldMapping['from'];
}): unknown => {
  if (typeof from === 'string') {
    return evaluateSourceField({ data, path: from });
  }
  const values = from.operands
    .map(({ field }) => evaluateSourceField({ data, path: field }))
    .filter((value) => value !== undefined);
  if (values.length === 0) {
    return undefined;
  }
  const numbers = values.flatMap((value) =>
    typeof value === 'number' && Number.isFinite(value) ? [value] : [],
  );
  // Never a partial total; and the sum is exact, so equal totals compare equal.
  return numbers.length === values.length ? sumAmounts(numbers) : BLOCKED;
};

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

const isEmptyValue = (value: unknown): boolean =>
  value === undefined || value === null || value === '';
