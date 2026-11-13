import { evaluateMappingExpression } from './evaluateMappingExpression';
import { isRecord, parseJsonPointer, writeJsonPointer } from './jsonPointer';
import type {
  MappingCandidate,
  MappingInput,
  MappingResult,
  MappingRule,
  SchemaRef,
} from './types';

/**
 * Collects a candidate per rule and matching input, keyed by target pointer.
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
  const candidatesByPointer = new Map<string, MappingCandidate[]>();

  for (const rule of rules) {
    if (
      !isSameSchemaRef({ left: rule.targetSchema, right: targetSchema }) ||
      !parseJsonPointer(rule.targetPointer)?.length
    ) {
      continue;
    }

    for (const input of inputs) {
      if (!isSameSchemaRef({ left: input.schema, right: rule.sourceSchema })) {
        continue;
      }
      const value = evaluateMappingExpression({
        expression: rule.value,
        data: input.data,
      });
      if (value === undefined) {
        continue;
      }

      const candidates = candidatesByPointer.get(rule.targetPointer) ?? [];
      candidates.push({ value: structuredClone(value), sourceId: input.id });
      candidatesByPointer.set(rule.targetPointer, candidates);
    }
  }

  const data: Record<string, unknown> = {};
  const pointersShallowFirst = [...candidatesByPointer.keys()].sort(
    comparePointerDepth,
  );
  for (const pointer of pointersShallowFirst) {
    const [first, ...rest] = candidatesByPointer.get(pointer) ?? [];
    if (
      first &&
      rest.every((candidate) =>
        isDeepEqual({ left: first.value, right: candidate.value }),
      )
    ) {
      writeJsonPointer({
        target: data,
        pointer,
        value: structuredClone(first.value),
      });
    }
  }

  return { data, candidates: Object.fromEntries(candidatesByPointer) };
};

export const isSameSchemaRef = ({
  left,
  right,
}: {
  left: SchemaRef;
  right: SchemaRef;
}): boolean => left.type === right.type && left.phaseId === right.phaseId;

const comparePointerDepth = (left: string, right: string): number =>
  getPointerDepth(left) - getPointerDepth(right) ||
  Number(left > right) - Number(left < right);

const getPointerDepth = (pointer: string): number =>
  parseJsonPointer(pointer)?.length ?? 0;

const isDeepEqual = ({
  left,
  right,
}: {
  left: unknown;
  right: unknown;
}): boolean => {
  if (Object.is(left, right)) {
    return true;
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((item, index) =>
        isDeepEqual({ left: item, right: right[index] }),
      )
    );
  }
  if (isRecord(left) && isRecord(right)) {
    const leftKeys = Object.keys(left);
    return (
      leftKeys.length === Object.keys(right).length &&
      leftKeys.every(
        (key) =>
          Object.hasOwn(right, key) &&
          isDeepEqual({ left: left[key], right: right[key] }),
      )
    );
  }
  return false;
};
