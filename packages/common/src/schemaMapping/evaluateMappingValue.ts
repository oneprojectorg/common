import { evaluateExpression } from '../services/decision/selectionPipeline/expressionEvaluator';
import type {
  ExecutionContext,
  Expression,
} from '../services/decision/selectionPipeline/types';
import { readOwnField } from './fieldPath';

const DATA_COLUMN = 'proposalData';

export const evaluateMappingValue = ({
  expression,
  data,
}: {
  expression: Expression;
  data: unknown;
}): unknown => {
  const hasMissingField = collectRequiredFields(expression).some((path) =>
    isEmptyValue(readOwnField({ data, path })),
  );
  if (hasMissingField) {
    return undefined;
  }

  const prefixed = prefixFields(expression);
  const context = buildExecutionContext(data);
  if (hasZeroDivisor({ expression: prefixed, context })) {
    return undefined;
  }

  const result: unknown = evaluateExpression(prefixed, context);
  return isEmptyValue(result) ||
    (typeof result === 'number' && !Number.isFinite(result))
    ? undefined
    : result;
};

// The evaluator's context type takes a proposal database row, so the data
// rides in a placeholder row whose other columns no rule can reach.
const buildExecutionContext = (data: unknown): ExecutionContext => ({
  proposals: [],
  proposal: {
    id: '',
    processInstanceId: '',
    proposalData: data,
    status: null,
    visibility: '',
    submittedByProfileId: '',
    profileId: '',
    lastEditedByProfileId: null,
    createdAt: null,
    updatedAt: null,
    deletedAt: null,
    moderationDetachedAt: null,
    shortCode: null,
    formSchemaId: null,
  },
  variables: {},
  outputs: {},
});

const prefixFields = (expression: Expression): Expression => {
  if ('field' in expression) {
    return { field: `${DATA_COLUMN}.${expression.field}` };
  }
  if ('left' in expression) {
    return {
      operator: expression.operator,
      left: prefixFields(expression.left),
      right: prefixFields(expression.right),
    };
  }
  if ('operands' in expression) {
    return {
      operator: expression.operator,
      operands: expression.operands.map(prefixFields),
    };
  }
  if ('function' in expression) {
    return {
      function: expression.function,
      arguments: expression.arguments.map(prefixFields),
    };
  }
  if ('value' in expression || 'variable' in expression) {
    return { ...expression };
  }
  if (expression.and) {
    return { and: expression.and.map(prefixFields) };
  }
  if (expression.or) {
    return { or: expression.or.map(prefixFields) };
  }
  if (expression.not) {
    return { not: prefixFields(expression.not) };
  }
  return {};
};

// The evaluator reads a missing operand as 0, so every field a rule reads must
// be present. Only a direct coalesce argument may be missing.
const collectRequiredFields = (expression: Expression): string[] => {
  if ('field' in expression) {
    return [expression.field];
  }
  if ('function' in expression && expression.function === 'coalesce') {
    return expression.arguments.flatMap((argument) =>
      'field' in argument ? [] : collectRequiredFields(argument),
    );
  }
  return getChildren(expression).flatMap(collectRequiredFields);
};

// The evaluator returns 0 for a division by 0 instead of failing.
const hasZeroDivisor = ({
  expression,
  context,
}: {
  expression: Expression;
  context: ExecutionContext;
}): boolean => {
  if (
    'operands' in expression &&
    (expression.operator === 'divide' || expression.operator === 'modulo')
  ) {
    const divisorIsZero = expression.operands.slice(1).some((operand) => {
      const divisor: unknown = evaluateExpression(operand, context);
      return typeof divisor !== 'number' || divisor === 0;
    });
    if (divisorIsZero) {
      return true;
    }
  }
  return getChildren(expression).some((child) =>
    hasZeroDivisor({ expression: child, context }),
  );
};

const getChildren = (expression: Expression): Expression[] => {
  if ('left' in expression) {
    return [expression.left, expression.right];
  }
  if ('operands' in expression) {
    return expression.operands;
  }
  if ('function' in expression) {
    return expression.arguments;
  }
  if (
    'field' in expression ||
    'value' in expression ||
    'variable' in expression
  ) {
    return [];
  }
  return [
    ...(expression.and ?? []),
    ...(expression.or ?? []),
    ...(expression.not ? [expression.not] : []),
  ];
};

const isEmptyValue = (value: unknown): boolean =>
  value === undefined || value === null || value === '';
