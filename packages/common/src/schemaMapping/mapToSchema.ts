import { logger } from '@op/logging';
import { isDeepStrictEqual } from 'node:util';

import { evaluateExpression } from '../services/decision/selectionPipeline/expressionEvaluator';
import type { Expression } from '../services/decision/selectionPipeline/types';
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

  const fieldValues: unknown[] = [];
  const expression = bindFields({
    expression: from,
    readField: (path) => {
      const value = readOwnField({ data, path });
      fieldValues.push(value);
      return value;
    },
  });
  if (fieldValues.every(isEmptyValue)) {
    return { status: 'empty' };
  }
  const value: unknown = evaluateExpression(expression, {
    record: {},
    variables: {},
    outputs: {},
  });
  return value == null ? { status: 'blocked' } : { status: 'filled', value };
};

/**
 * Replaces each field read with the value of the input's own field, since the
 * evaluator also reads inherited properties.
 */
const bindFields = ({
  expression,
  readField,
}: {
  expression: Expression;
  readField: (path: string) => unknown;
}): Expression => {
  const bind = (child: Expression) =>
    bindFields({ expression: child, readField });

  if ('field' in expression) {
    return { value: readField(expression.field) };
  }
  if ('left' in expression) {
    return {
      ...expression,
      left: bind(expression.left),
      right: bind(expression.right),
    };
  }
  if ('operands' in expression) {
    return { ...expression, operands: expression.operands.map(bind) };
  }
  if ('arguments' in expression) {
    return { ...expression, arguments: expression.arguments.map(bind) };
  }
  if ('and' in expression || 'or' in expression || 'not' in expression) {
    return {
      ...(expression.and && { and: expression.and.map(bind) }),
      ...(expression.or && { or: expression.or.map(bind) }),
      ...(expression.not && { not: bind(expression.not) }),
    };
  }
  return expression;
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
