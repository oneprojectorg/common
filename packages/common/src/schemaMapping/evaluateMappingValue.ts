import { evaluateExpression } from '../services/decision/selectionPipeline/expressionEvaluator';
import type { ExecutionContext } from '../services/decision/selectionPipeline/types';
import { readOwnField } from './fieldPath';
import type { MappingExpression } from './types';

export const evaluateMappingValue = ({
  expression,
  data,
}: {
  expression: MappingExpression;
  data: unknown;
}): unknown => {
  // The evaluator reads a missing operand as 0.
  const hasEmptyField = getFields(expression).some((path) =>
    isEmptyValue(readOwnField({ data, path })),
  );
  if (hasEmptyField) {
    return undefined;
  }

  const result: unknown = evaluateExpression(
    prefixFields(expression),
    buildExecutionContext(data),
  );
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

const prefixFields = (expression: MappingExpression): MappingExpression => {
  if ('field' in expression) {
    return { field: `proposalData.${expression.field}` };
  }
  if ('operands' in expression) {
    return {
      operator: expression.operator,
      operands: expression.operands.map(prefixFields),
    };
  }
  return { value: expression.value };
};

const getFields = (expression: MappingExpression): string[] => {
  if ('field' in expression) {
    return [expression.field];
  }
  return 'operands' in expression ? expression.operands.flatMap(getFields) : [];
};

const isEmptyValue = (value: unknown): boolean =>
  value === undefined || value === null || value === '';
