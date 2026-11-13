import type { Expression } from '../services/decision/selectionPipeline/types';
import { isRecord } from './fieldPath';
import { isSameSchemaRef } from './mapToSchema';
import type {
  MappingRule,
  MappingRuleProblem,
  MappingTypeDescription,
  NumericOperation,
  SchemaEntry,
  SchemaRef,
} from './types';

type SchemaNodeType = MappingTypeDescription & { nullable: boolean };

type JsonSchemaType = Exclude<MappingTypeDescription['type'], 'unknown'>;

const JSON_SCHEMA_TYPES = new Set<string>([
  'string',
  'number',
  'integer',
  'boolean',
  'object',
  'array',
  'null',
]);

const NUMERIC_TYPES = new Set<string>(['number', 'integer', 'unknown']);

const TEXT_TYPES = new Set<string>(['string', 'number', 'integer', 'unknown']);

const STRING_TYPES = new Set<string>(['string', 'unknown']);

const ARRAY_INDEX_PATTERN = /^(0|[1-9]\d*)$/;

const UNKNOWN_TYPE: SchemaNodeType = { type: 'unknown', nullable: false };
const BOOLEAN_TYPE: SchemaNodeType = { type: 'boolean', nullable: false };
const NUMBER_TYPE: SchemaNodeType = { type: 'number', nullable: false };
const INTEGER_TYPE: SchemaNodeType = { type: 'integer', nullable: false };
const STRING_TYPE: SchemaNodeType = { type: 'string', nullable: false };

/**
 * Compares each rule with the JSON Schemas it names, never with data, so a
 * rule problem is found when the rule is saved. Returns every problem of
 * every rule; an empty list means the rules are consistent with the schemas.
 */
export const checkMappingRules = ({
  rules,
  schemas,
}: {
  rules: MappingRule[];
  schemas: SchemaEntry[];
}): MappingRuleProblem[] =>
  rules.flatMap((rule, ruleIndex) =>
    checkMappingRule({ rule, ruleIndex, schemas }),
  );

const checkMappingRule = ({
  rule,
  ruleIndex,
  schemas,
}: {
  rule: MappingRule;
  ruleIndex: number;
  schemas: SchemaEntry[];
}): MappingRuleProblem[] => {
  const problems: MappingRuleProblem[] = [];
  const sourceEntry = findSchemaEntry({ schemas, ref: rule.sourceSchema });
  const targetEntry = findSchemaEntry({ schemas, ref: rule.targetSchema });

  if (!sourceEntry) {
    problems.push({
      code: 'unknownSourceSchema',
      ruleIndex,
      schema: { ...rule.sourceSchema },
    });
  }
  if (!targetEntry) {
    problems.push({
      code: 'unknownTargetSchema',
      ruleIndex,
      schema: { ...rule.targetSchema },
    });
  }

  const sourceType = inferExpressionType({
    expression: rule.value,
    sourceEntry,
    ruleIndex,
    problems,
  });

  if (!targetEntry) {
    return problems;
  }

  const targetType = resolveSchemaField({
    schema: targetEntry.schema,
    field: rule.targetField,
  });
  if (!targetType) {
    problems.push({
      code: 'targetFieldNotFound',
      ruleIndex,
      field: rule.targetField,
    });
  } else if (!isAssignable({ source: sourceType, target: targetType })) {
    problems.push({
      code: 'typeMismatch',
      ruleIndex,
      sourceType: toDescription(sourceType),
      targetType: toDescription(targetType),
    });
  }
  return problems;
};

const findSchemaEntry = ({
  schemas,
  ref,
}: {
  schemas: SchemaEntry[];
  ref: SchemaRef;
}): SchemaEntry | undefined =>
  schemas.find((entry) => isSameSchemaRef({ left: entry.ref, right: ref }));

const inferExpressionType = ({
  expression,
  sourceEntry,
  ruleIndex,
  problems,
}: {
  expression: Expression;
  sourceEntry: SchemaEntry | undefined;
  ruleIndex: number;
  problems: MappingRuleProblem[];
}): SchemaNodeType => {
  const infer = (child: Expression) =>
    inferExpressionType({
      expression: child,
      sourceEntry,
      ruleIndex,
      problems,
    });
  const checkNumbers = ({
    operation,
    operands,
  }: {
    operation: NumericOperation;
    operands: Expression[];
  }) =>
    checkOperandTypes({
      operandTypes: operands.map(infer),
      allowed: NUMERIC_TYPES,
      toProblem: (operandType) => ({
        code: 'operandNotNumber',
        ruleIndex,
        operation,
        operandType,
      }),
      problems,
    });
  const checkText = ({
    operands,
    allowed,
  }: {
    operands: Expression[];
    allowed: Set<string>;
  }) =>
    checkOperandTypes({
      operandTypes: operands.map(infer),
      allowed,
      toProblem: (operandType) => ({
        code: 'operandNotText',
        ruleIndex,
        operandType,
      }),
      problems,
    });

  if ('field' in expression) {
    if (!sourceEntry) {
      return UNKNOWN_TYPE;
    }
    const nodeType = resolveSchemaField({
      schema: sourceEntry.schema,
      field: expression.field,
    });
    if (!nodeType) {
      problems.push({
        code: 'sourceFieldNotFound',
        ruleIndex,
        field: expression.field,
      });
      return UNKNOWN_TYPE;
    }
    return nodeType;
  }
  if ('left' in expression) {
    infer(expression.left);
    infer(expression.right);
    return BOOLEAN_TYPE;
  }
  if ('operands' in expression) {
    checkNumbers({
      operation: expression.operator,
      operands: expression.operands,
    });
    return NUMBER_TYPE;
  }
  if ('value' in expression) {
    return getLiteralType(expression.value);
  }
  if ('variable' in expression) {
    return UNKNOWN_TYPE;
  }
  if (!('function' in expression)) {
    [
      ...(expression.and ?? []),
      ...(expression.or ?? []),
      ...(expression.not ? [expression.not] : []),
    ].forEach(infer);
    return BOOLEAN_TYPE;
  }

  const { arguments: operands } = expression;
  switch (expression.function) {
    case 'sum':
    case 'avg':
    case 'min':
    case 'max':
      checkNumbers({ operation: expression.function, operands });
      return NUMBER_TYPE;
    case 'abs': {
      const [operandType] = checkNumbers({ operation: 'abs', operands });
      return operandType?.type === 'integer' ? INTEGER_TYPE : NUMBER_TYPE;
    }
    case 'round':
    case 'floor':
    case 'ceil':
      checkNumbers({ operation: expression.function, operands });
      return INTEGER_TYPE;
    case 'count':
    case 'length':
      operands.forEach(infer);
      return INTEGER_TYPE;
    case 'concat':
      checkText({ operands, allowed: TEXT_TYPES });
      return STRING_TYPE;
    case 'toLowerCase':
    case 'toUpperCase':
    case 'trim':
      checkText({ operands, allowed: STRING_TYPES });
      return STRING_TYPE;
    case 'coalesce':
      return getCommonType(operands.map(infer));
    case 'if': {
      const [condition, ...branches] = operands;
      if (condition) {
        infer(condition);
      }
      return getCommonType(branches.map(infer));
    }
    default:
      operands.forEach(infer);
      return UNKNOWN_TYPE;
  }
};

const checkOperandTypes = ({
  operandTypes,
  allowed,
  toProblem,
  problems,
}: {
  operandTypes: SchemaNodeType[];
  allowed: Set<string>;
  toProblem: (operandType: MappingTypeDescription) => MappingRuleProblem;
  problems: MappingRuleProblem[];
}): SchemaNodeType[] => {
  for (const operandType of operandTypes) {
    if (!allowed.has(operandType.type)) {
      problems.push(toProblem(toDescription(operandType)));
    }
  }
  return operandTypes;
};

const getLiteralType = (value: unknown): SchemaNodeType => {
  if (value === null) {
    return { type: 'null', nullable: true };
  }
  if (Array.isArray(value)) {
    return { type: 'array', nullable: false };
  }
  if (typeof value === 'object') {
    return { type: 'object', nullable: false };
  }
  if (typeof value === 'number') {
    return {
      type: Number.isInteger(value) ? 'integer' : 'number',
      nullable: false,
    };
  }
  if (typeof value === 'string') {
    return STRING_TYPE;
  }
  return typeof value === 'boolean' ? BOOLEAN_TYPE : UNKNOWN_TYPE;
};

const getCommonType = (types: SchemaNodeType[]): SchemaNodeType => {
  const [first, ...rest] = types;
  if (
    !first ||
    rest.some(
      (other) => other.type !== first.type || other.format !== first.format,
    )
  ) {
    return UNKNOWN_TYPE;
  }
  return first;
};

const isAssignable = ({
  source,
  target,
}: {
  source: SchemaNodeType;
  target: SchemaNodeType;
}): boolean => {
  if (source.type === 'unknown' || target.type === 'unknown') {
    return true;
  }
  if (source.type === 'null') {
    return target.nullable;
  }
  if (source.type === 'integer' && target.type === 'number') {
    return true;
  }
  if (source.type !== target.type) {
    return false;
  }
  return source.type !== 'object' || source.format === target.format;
};

/**
 * Walks `properties` for object keys and `items` for array indexes. Returns
 * undefined when the dot path names no node, and an unknown type when the
 * walk meets a `$ref` it cannot follow.
 */
const resolveSchemaField = ({
  schema,
  field,
}: {
  schema: unknown;
  field: string;
}): SchemaNodeType | undefined => {
  let node = schema;
  for (const token of field.split('.')) {
    if (!isRecord(node)) {
      return undefined;
    }
    if (Object.hasOwn(node, '$ref')) {
      return UNKNOWN_TYPE;
    }

    const { properties, items } = node;
    let child: unknown;
    if (isRecord(properties) && Object.hasOwn(properties, token)) {
      child = properties[token];
    } else if (ARRAY_INDEX_PATTERN.test(token)) {
      child = Array.isArray(items) ? items[Number(token)] : items;
    }
    if (child === undefined) {
      return undefined;
    }
    node = child;
  }
  return describeSchemaNode(node);
};

const describeSchemaNode = (node: unknown): SchemaNodeType => {
  if (!isRecord(node) || Object.hasOwn(node, '$ref')) {
    return UNKNOWN_TYPE;
  }

  const declaredTypes: unknown[] = Array.isArray(node.type)
    ? node.type
    : [node.type];
  const nullable = declaredTypes.includes('null');
  const nonNullTypes = declaredTypes.filter(
    (declared) => declared !== undefined && declared !== 'null',
  );

  if (nullable && nonNullTypes.length === 0) {
    return { type: 'null', nullable };
  }
  const [declared] = nonNullTypes;
  if (nonNullTypes.length !== 1 || !isJsonSchemaType(declared)) {
    return { type: 'unknown', nullable };
  }

  const format = node['x-format'];
  if (declared === 'object' && typeof format === 'string') {
    return { type: declared, format, nullable };
  }
  return { type: declared, nullable };
};

const isJsonSchemaType = (value: unknown): value is JsonSchemaType =>
  typeof value === 'string' && JSON_SCHEMA_TYPES.has(value);

const toDescription = ({
  type,
  format,
}: SchemaNodeType): MappingTypeDescription =>
  format === undefined ? { type } : { type, format };
