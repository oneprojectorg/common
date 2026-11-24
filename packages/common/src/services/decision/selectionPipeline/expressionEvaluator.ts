import { logger } from '@op/logging';
import safeRegex from 'safe-regex2';

import type { ValueType } from '../../../valueTypes/valueType';
import type {
  ArithmeticExpression,
  ComparisonExpression,
  Expression,
  ExpressionContext,
  FieldAccessExpression,
  FunctionCallExpression,
  LiteralExpression,
  LogicalExpression,
  VariableExpression,
} from './types';

/**
 * Evaluates an expression in the given context
 */
export function evaluateExpression(
  expr: Expression,
  context: ExpressionContext,
): any {
  // Field access
  if ('field' in expr) {
    return evaluateFieldAccess(expr as FieldAccessExpression, context);
  }

  // Comparison
  if ('operator' in expr && 'left' in expr && 'right' in expr) {
    return evaluateComparison(expr as ComparisonExpression, context);
  }

  // Logical operations
  if ('and' in expr || 'or' in expr || 'not' in expr) {
    return evaluateLogical(expr as LogicalExpression, context);
  }

  // Arithmetic
  if ('operator' in expr && 'operands' in expr) {
    return evaluateArithmetic(expr as ArithmeticExpression, context);
  }

  // Function call
  if ('function' in expr && 'arguments' in expr) {
    return evaluateFunctionCall(expr as FunctionCallExpression, context);
  }

  // Literal
  if ('value' in expr) {
    return (expr as LiteralExpression).value;
  }

  // Variable
  if ('variable' in expr) {
    return evaluateVariable(expr as VariableExpression, context);
  }

  throw new Error(`Unknown expression type: ${JSON.stringify(expr)}`);
}

/**
 * Access a field using dot notation
 */
function evaluateFieldAccess(
  expr: FieldAccessExpression,
  context: ExpressionContext,
): any {
  const path = expr.field.split('.');
  let current: any = context.record;

  for (const key of path) {
    if (current == null) {
      return null;
    }
    current = current[key];
  }

  return current;
}

/**
 * Evaluate a comparison expression
 */
function evaluateComparison(
  expr: ComparisonExpression,
  context: ExpressionContext,
): boolean {
  const left = evaluateExpression(expr.left, context);
  const right = evaluateExpression(expr.right, context);

  switch (expr.operator) {
    case 'equals':
      return left === right;
    case 'notEquals':
      return left !== right;
    case 'greaterThan':
      return left > right;
    case 'lessThan':
      return left < right;
    case 'greaterThanOrEquals':
      return left >= right;
    case 'lessThanOrEquals':
      return left <= right;
    case 'in':
      return Array.isArray(right) && right.includes(left);
    case 'notIn':
      return Array.isArray(right) && !right.includes(left);
    case 'contains':
      if (typeof left === 'string') {
        return left.includes(String(right));
      }
      if (Array.isArray(left)) {
        return left.includes(right);
      }
      return false;
    case 'startsWith':
      return typeof left === 'string' && left.startsWith(String(right));
    case 'endsWith':
      return typeof left === 'string' && left.endsWith(String(right));
    case 'matches':
      if (typeof left === 'string' && typeof right === 'string') {
        try {
          // Validate regex pattern is safe from ReDoS attacks
          if (!safeRegex(right)) {
            logger.error('Unsafe regex pattern detected', { pattern: right });
            return false;
          }
          const regex = new RegExp(right);
          return regex.test(left);
        } catch (error) {
          // Invalid regex pattern
          logger.error('Invalid regex pattern', { pattern: right, error });
          return false;
        }
      }
      return false;
    default:
      throw new Error(`Unknown comparison operator: ${expr.operator}`);
  }
}

/**
 * Evaluate logical expressions
 */
function evaluateLogical(
  expr: LogicalExpression,
  context: ExpressionContext,
): boolean {
  if (expr.and) {
    return expr.and.every((e) => evaluateExpression(e, context));
  }

  if (expr.or) {
    return expr.or.some((e) => evaluateExpression(e, context));
  }

  if (expr.not) {
    return !evaluateExpression(expr.not, context);
  }

  throw new Error('Invalid logical expression');
}

/**
 * Evaluate arithmetic expressions
 */
function evaluateArithmetic(
  expr: ArithmeticExpression,
  context: ExpressionContext,
): unknown {
  const operands: unknown[] = expr.operands.map((op) =>
    evaluateExpression(op, context),
  );
  if (
    expr.operator === 'add' &&
    context.valueTypes &&
    !operands.every((operand) => typeof operand === 'number')
  ) {
    return addTypedValues({ operands, valueTypes: context.valueTypes });
  }
  const values = operands.map((val) => (typeof val === 'number' ? val : 0));

  switch (expr.operator) {
    case 'add':
      return values.reduce((a, b) => a + b, 0);
    case 'subtract':
      return values.reduce((a, b) => a - b);
    case 'multiply':
      return values.reduce((a, b) => a * b, 1);
    case 'divide':
      return values.reduce((a, b) => (b !== 0 ? a / b : 0));
    case 'modulo':
      return values.reduce((a, b) => (b !== 0 ? a % b : 0));
    case 'power':
      return values.reduce((a, b) => Math.pow(a, b));
    default:
      throw new Error(`Unknown arithmetic operator: ${expr.operator}`);
  }
}

/**
 * Null unless exactly one value type accepts every operand that is not null
 * and can add them all. A missing operand is skipped.
 */
function addTypedValues({
  operands,
  valueTypes,
}: {
  operands: unknown[];
  valueTypes: readonly ValueType<unknown>[];
}): unknown {
  const present = operands.filter((operand) => operand != null);
  const matches = valueTypes.flatMap((type) => {
    const values = present.map((operand) => type.parse(operand));
    return values.every((value) => value !== undefined)
      ? [{ type, values }]
      : [];
  });
  const [match, ...otherMatches] = matches;
  if (!match || otherMatches.length > 0) {
    return null;
  }

  const [first, ...rest] = match.values;
  if (first === undefined) {
    return null;
  }
  let total = first;
  for (const value of rest) {
    const sum = match.type.add(total, value);
    if (sum === undefined) {
      return null;
    }
    total = sum;
  }
  return total;
}

/**
 * Evaluate function calls
 */
function evaluateFunctionCall(
  expr: FunctionCallExpression,
  context: ExpressionContext,
): any {
  const args = expr.arguments.map((arg) => evaluateExpression(arg, context));
  const evaluate = FUNCTIONS.get(expr.function);
  if (!evaluate) {
    throw new Error(`Unknown function: ${expr.function}`);
  }
  return evaluate(args);
}

// A Map, not an object literal, so a name such as `constructor` stays unknown.
const FUNCTIONS = new Map<string, (args: unknown[]) => unknown>([
  ['sum', sumNumbers],
  ['avg', (args) => (args.length === 0 ? 0 : sumNumbers(args) / args.length)],
  ['count', (args) => args.length],
  ['min', (args) => Math.min(...args.filter(isNumber))],
  ['max', (args) => Math.max(...args.filter(isNumber))],
  [
    'if',
    (args) => {
      if (args.length !== 3) {
        throw new Error('if function requires 3 arguments');
      }
      const [condition, whenTrue, whenFalse] = args;
      return condition ? whenTrue : whenFalse;
    },
  ],
  ['coalesce', (args) => args.find((value) => value != null) ?? null],
  ['concat', (args) => args.map(String).join('')],
  [
    'length',
    ([first]) =>
      typeof first === 'string' || Array.isArray(first) ? first.length : 0,
  ],
  ['abs', ([first]) => (isNumber(first) ? Math.abs(first) : 0)],
  ['round', ([first]) => (isNumber(first) ? Math.round(first) : 0)],
  ['floor', ([first]) => (isNumber(first) ? Math.floor(first) : 0)],
  ['ceil', ([first]) => (isNumber(first) ? Math.ceil(first) : 0)],
  [
    'toLowerCase',
    ([first]) => (typeof first === 'string' ? first.toLowerCase() : ''),
  ],
  [
    'toUpperCase',
    ([first]) => (typeof first === 'string' ? first.toUpperCase() : ''),
  ],
  ['trim', ([first]) => (typeof first === 'string' ? first.trim() : '')],
]);

function sumNumbers(args: unknown[]): number {
  return args.reduce<number>(
    (sum, value) => sum + (isNumber(value) ? value : 0),
    0,
  );
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number';
}

/**
 * Evaluate variable references
 */
function evaluateVariable(
  expr: VariableExpression,
  context: ExpressionContext,
): any {
  const varName = expr.variable.startsWith('$')
    ? expr.variable.slice(1)
    : expr.variable;

  if (varName in context.variables) {
    return context.variables[varName];
  }

  if (varName in context.outputs) {
    return context.outputs[varName];
  }

  return null;
}

// Keys that could lead to prototype pollution
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Helper to set a value in an object using dot notation
 * Guards against prototype pollution by blocking dangerous keys
 */
export function setValueByPath(obj: any, path: string, value: any): void {
  const parts = path.split('.');
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!part || DANGEROUS_KEYS.has(part)) {
      continue;
    }
    if (!(part in current) || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part];
  }

  const lastPart = parts[parts.length - 1];
  if (lastPart && !DANGEROUS_KEYS.has(lastPart)) {
    current[lastPart] = value;
  }
}

/**
 * Helper to get a value from an object using dot notation
 */
export function getValueByPath(obj: any, path: string): any {
  const parts = path.split('.');
  let current = obj;

  for (const part of parts) {
    if (current == null || DANGEROUS_KEYS.has(part)) {
      return null;
    }
    current = current[part];
  }

  return current;
}
