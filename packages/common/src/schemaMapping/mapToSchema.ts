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

type InputValue =
  | { status: 'filled'; value: unknown }
  | { status: 'empty' }
  | { status: 'blocked' };

/**
 * Maps each field of each mapping from each input of the mapping's source
 * schema. A target field is filled only when all its values are equal, and
 * never when an input of an `add` rule has a value that is not a number.
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

  for (const mapping of mappings) {
    if (!isSameSchemaRef({ left: mapping.to, right: targetSchema })) {
      continue;
    }
    const sources = inputs.filter((input) =>
      isSameSchemaRef({ left: input.schema, right: mapping.from }),
    );

    for (const field of mapping.fields) {
      for (const source of sources) {
        const result = evaluateRule({ from: field.from, data: source.data });
        if (result.status === 'blocked') {
          // Skipping the input would fill the field from the other inputs.
          logger.warn(
            'A mapping rule could not add its values; field left empty',
            {
              targetPhaseId: targetSchema.phaseId,
              field: field.to,
            },
          );
          blockedFields.add(field.to);
          continue;
        }
        if (result.status === 'empty') {
          continue;
        }
        const values = valuesByField.get(field.to) ?? [];
        values.push(result.value);
        valuesByField.set(field.to, values);
      }
    }
  }

  // Object.fromEntries defines own keys, so a `__proto__` key from a mapping
  // that skipped validation cannot change the prototype.
  const data = Object.fromEntries(
    [...valuesByField].flatMap<[string, unknown]>(([field, [first, ...rest]]) =>
      !blockedFields.has(field) &&
      rest.every((value) => isDeepStrictEqual(first, value))
        ? [[field, structuredClone(first)]]
        : [],
    ),
  );

  return { data };
};

const evaluateRule = ({
  from,
  data,
}: {
  from: FieldMapping['from'];
  data: unknown;
}): InputValue => {
  if (typeof from === 'string') {
    const value = evaluateSourceField({ data, path: from });
    return value === undefined
      ? { status: 'empty' }
      : { status: 'filled', value };
  }
  return addFields({
    paths: from.operands.map((operand) => operand.field),
    data,
  });
};

/** A missing field is skipped; any other value that is not a finite number blocks. */
const addFields = ({
  paths,
  data,
}: {
  paths: string[];
  data: unknown;
}): InputValue => {
  const operands = paths
    .map((path) => readOwnField({ data, path }))
    .filter((value) => value !== undefined);
  if (operands.length === 0) {
    return { status: 'empty' };
  }
  const numbers = operands.flatMap((value) =>
    typeof value === 'number' && Number.isFinite(value) ? [value] : [],
  );
  if (numbers.length !== operands.length) {
    return { status: 'blocked' };
  }
  // Float addition would give 0.1 + 0.2 = 0.30000000000000004.
  return { status: 'filled', value: sumAmounts(numbers) };
};

export const isSameSchemaRef = ({
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

const isEmptyValue = (value: unknown): boolean =>
  value === undefined || value === null || value === '';
