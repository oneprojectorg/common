import { isDeepStrictEqual } from 'node:util';

import { setValueByPath } from '../services/decision/selectionPipeline/expressionEvaluator';
import { evaluateMappingValue } from './evaluateMappingValue';
import { getFieldPathDepth, isRecord } from './fieldPath';
import type {
  MappingInput,
  MappingResult,
  MappingRule,
  SchemaRef,
} from './types';

/**
 * Evaluates each rule for each input of its source schema. A target field is
 * filled only when all its values are equal.
 */
export const mapToSchema = ({
  rules,
  inputs,
  targetSchema,
}: {
  rules: MappingRule[];
  inputs: MappingInput[];
  targetSchema: SchemaRef;
}): MappingResult => {
  const valuesByField = new Map<string, unknown[]>();

  for (const rule of rules) {
    if (!isSameSchemaRef({ left: rule.targetSchema, right: targetSchema })) {
      continue;
    }

    for (const input of inputs) {
      if (!isSameSchemaRef({ left: input.schema, right: rule.sourceSchema })) {
        continue;
      }
      const value = evaluateMappingValue({
        expression: rule.value,
        data: input.data,
      });
      if (value === undefined) {
        continue;
      }

      const values = valuesByField.get(rule.targetField) ?? [];
      values.push(value);
      valuesByField.set(rule.targetField, values);
    }
  }

  const data: Record<string, unknown> = {};
  const fieldsShallowFirst = [...valuesByField.keys()].sort(compareFieldDepth);
  for (const field of fieldsShallowFirst) {
    const [first, ...rest] = valuesByField.get(field) ?? [];
    if (
      rest.every((value) => isDeepStrictEqual(first, value)) &&
      !passesThroughNonObject({ data, path: field })
    ) {
      setValueByPath(data, field, structuredClone(first));
    }
  }

  return { data };
};

export const isSameSchemaRef = ({
  left,
  right,
}: {
  left: SchemaRef;
  right: SchemaRef;
}): boolean => left.type === right.type && left.phaseId === right.phaseId;

const compareFieldDepth = (left: string, right: string): number =>
  getFieldPathDepth(left) - getFieldPathDepth(right) ||
  Number(left > right) - Number(left < right);

// setValueByPath replaces a value that is not an object with one, which would
// drop a field filled by a shallower rule.
const passesThroughNonObject = ({
  data,
  path,
}: {
  data: Record<string, unknown>;
  path: string;
}): boolean => {
  let current: unknown = data;
  for (const segment of path.split('.').slice(0, -1)) {
    if (!isRecord(current)) {
      return true;
    }
    if (!Object.hasOwn(current, segment)) {
      return false;
    }
    current = current[segment];
  }
  return !isRecord(current);
};
