import { isDeepStrictEqual } from 'node:util';

import { setValueByPath } from '../services/decision/selectionPipeline/expressionEvaluator';
import { evaluateMappingValue } from './evaluateMappingValue';
import { getFieldPathDepth, isRecord } from './fieldPath';
import type {
  MappingCandidate,
  MappingInput,
  MappingResult,
  MappingRule,
  SchemaRef,
} from './types';

/**
 * Collects a candidate per rule and matching input, keyed by target field.
 * A target field is filled only when all its candidates are equal.
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
  const candidatesByField = new Map<string, MappingCandidate[]>();

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

      const candidates = candidatesByField.get(rule.targetField) ?? [];
      candidates.push({ value: structuredClone(value), sourceId: input.id });
      candidatesByField.set(rule.targetField, candidates);
    }
  }

  const data: Record<string, unknown> = {};
  const fieldsShallowFirst = [...candidatesByField.keys()].sort(
    compareFieldDepth,
  );
  for (const field of fieldsShallowFirst) {
    const [first, ...rest] = candidatesByField.get(field) ?? [];
    if (
      first &&
      rest.every((candidate) =>
        isDeepStrictEqual(first.value, candidate.value),
      ) &&
      !passesThroughNonObject({ data, path: field })
    ) {
      setValueByPath(data, field, structuredClone(first.value));
    }
  }

  return { data, candidates: Object.fromEntries(candidatesByField) };
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
