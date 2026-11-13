import { ARRAY_INDEX_PATTERN, isRecord, parseJsonPointer } from './jsonPointer';
import { isSameSchemaRef } from './mapToSchema';
import type {
  MappingExpression,
  MappingRule,
  MappingRuleProblem,
  MappingTypeDescription,
  MappingValue,
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

const UNKNOWN_TYPE: SchemaNodeType = { type: 'unknown', nullable: false };

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

  const targetType = resolveSchemaPointer({
    schema: targetEntry.schema,
    pointer: rule.targetPointer,
  });
  if (!targetType) {
    problems.push({
      code: 'targetPointerNotFound',
      ruleIndex,
      pointer: rule.targetPointer,
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
  expression: MappingExpression;
  sourceEntry: SchemaEntry | undefined;
  ruleIndex: number;
  problems: MappingRuleProblem[];
}): SchemaNodeType => {
  if ('pointer' in expression) {
    if (!sourceEntry) {
      return UNKNOWN_TYPE;
    }
    const nodeType = resolveSchemaPointer({
      schema: sourceEntry.schema,
      pointer: expression.pointer,
    });
    if (!nodeType) {
      problems.push({
        code: 'sourcePointerNotFound',
        ruleIndex,
        pointer: expression.pointer,
      });
      return UNKNOWN_TYPE;
    }
    return nodeType;
  }
  if ('value' in expression) {
    return getLiteralType(expression.value);
  }

  const inferChildren = (children: MappingExpression[]) =>
    children.map((child) =>
      inferExpressionType({
        expression: child,
        sourceEntry,
        ruleIndex,
        problems,
      }),
    );

  if ('operator' in expression) {
    checkNumericOperands({
      operation: expression.operator,
      operandTypes: inferChildren(expression.operands),
      ruleIndex,
      problems,
    });
    return { type: 'number', nullable: false };
  }

  const argumentTypes = inferChildren(expression.arguments);
  switch (expression.function) {
    case 'sum':
      checkNumericOperands({
        operation: 'sum',
        operandTypes: argumentTypes,
        ruleIndex,
        problems,
      });
      return { type: 'number', nullable: false };
    case 'round':
      checkNumericOperands({
        operation: 'round',
        operandTypes: argumentTypes,
        ruleIndex,
        problems,
      });
      return { type: 'integer', nullable: false };
    case 'concat':
      for (const operandType of argumentTypes) {
        if (!TEXT_TYPES.has(operandType.type)) {
          problems.push({
            code: 'operandNotText',
            ruleIndex,
            operandType: toDescription(operandType),
          });
        }
      }
      return { type: 'string', nullable: false };
    case 'coalesce':
      return getCommonType(argumentTypes);
  }
};

const checkNumericOperands = ({
  operation,
  operandTypes,
  ruleIndex,
  problems,
}: {
  operation: NumericOperation;
  operandTypes: SchemaNodeType[];
  ruleIndex: number;
  problems: MappingRuleProblem[];
}): void => {
  for (const operandType of operandTypes) {
    if (!NUMERIC_TYPES.has(operandType.type)) {
      problems.push({
        code: 'operandNotNumber',
        ruleIndex,
        operation,
        operandType: toDescription(operandType),
      });
    }
  }
};

const getLiteralType = (value: MappingValue): SchemaNodeType => {
  if (value === null) {
    return { type: 'null', nullable: true };
  }
  if (typeof value === 'number') {
    return {
      type: Number.isInteger(value) ? 'integer' : 'number',
      nullable: false,
    };
  }
  return {
    type: typeof value === 'string' ? 'string' : 'boolean',
    nullable: false,
  };
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
 * undefined when the pointer names no node, and an unknown type when the walk
 * meets a `$ref` it cannot follow.
 */
const resolveSchemaPointer = ({
  schema,
  pointer,
}: {
  schema: unknown;
  pointer: string;
}): SchemaNodeType | undefined => {
  const tokens = parseJsonPointer(pointer);
  if (!tokens) {
    return undefined;
  }

  let node = schema;
  for (const token of tokens) {
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
