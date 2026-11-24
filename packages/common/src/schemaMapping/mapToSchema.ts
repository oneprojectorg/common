import { logger } from '@op/logging';
import { isDeepStrictEqual } from 'node:util';

import {
  createExpressionEvaluator,
  evaluateExpression,
} from '../services/decision/selectionPipeline/expressionEvaluator';
import { moneyValueType } from '../valueTypes/moneyValueType';
import { readOwnField } from './fieldPath';
import type {
  FieldMapping,
  MappingInput,
  MappingResult,
  SchemaMapping,
  SchemaRef,
} from './schema';

const valueTypes = [moneyValueType];
const evaluateTypedExpression = createExpressionEvaluator({ valueTypes });

type InputValue =
  | { status: 'filled'; value: unknown }
  | { status: 'empty' }
  | { status: 'blocked' };

/**
 * Maps each field of each mapping from each input of the mapping's source
 * schema. A target field is filled only when all its values are equal, and
 * never when an input has values for an expression that gives no result.
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
          logger.warn('A mapping expression gave no value; field left empty', {
            targetPhaseId: targetSchema.phaseId,
            field: field.to,
          });
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

  // Each operand goes through the copy rule's field read, so an inherited or
  // empty field is a missing operand.
  const values = from.operands.flatMap(({ field }) => {
    const value = evaluateSourceField({ data, path: field });
    return value === undefined ? [] : [{ value }];
  });
  if (values.length === 0) {
    return { status: 'empty' };
  }
  const value = evaluateTypedExpression(
    { operator: from.operator, operands: values },
    { record: data, variables: {}, outputs: {} },
  );
  // A plain-number result has no type, so a sum of numbers has no currency.
  return valueTypes.some((type) => type.parse(value) !== undefined)
    ? { status: 'filled', value }
    : { status: 'blocked' };
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

const isEmptyValue = (value: unknown): boolean =>
  value === undefined || value === null || value === '';
