import { logger } from '@op/logging';
import safeRegex from 'safe-regex2';

import type {
  ArithmeticExpression,
  ComparisonExpression,
  ExecutionContext,
  Expression,
  FieldAccessExpression,
  FunctionCallExpression,
  LiteralExpression,
  LogicalExpression,
  VariableExpression,
} from './types';

const VOTE_DATA_PREFIX = 'voteData.';

/**
 * Evaluates an expression in the given context
 */
export function evaluateExpression(
  expr: Expression,
  context: ExecutionContext,
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
 * Access a field using dot notation. With a proposal in scope, `voteData.*`
 * reads that proposal's own metrics.
 */
function evaluateFieldAccess(
  expr: FieldAccessExpression,
  context: ExecutionContext,
): any {
  if (context.proposal && expr.field.startsWith(VOTE_DATA_PREFIX)) {
    return getValueByPath(
      context.voteData?.[context.proposal.id],
      expr.field.slice(VOTE_DATA_PREFIX.length),
    );
  }

  return getValueByPath(context.proposal || context, expr.field);
}

// Operands are untyped JSON values; the relational operators keep JavaScript's coercion.
type ComparisonHandler = (left: any, right: any) => boolean;

const comparisonHandlers = new Map<
  ComparisonExpression['operator'],
  ComparisonHandler
>([
  ['equals', (left, right) => left === right],
  ['notEquals', (left, right) => left !== right],
  ['greaterThan', (left, right) => left > right],
  ['lessThan', (left, right) => left < right],
  ['greaterThanOrEquals', (left, right) => left >= right],
  ['lessThanOrEquals', (left, right) => left <= right],
  ['in', (left, right) => Array.isArray(right) && right.includes(left)],
  ['notIn', (left, right) => Array.isArray(right) && !right.includes(left)],
  [
    'contains',
    (left, right) =>
      typeof left === 'string'
        ? left.includes(String(right))
        : Array.isArray(left) && left.includes(right),
  ],
  [
    'startsWith',
    (left, right) => typeof left === 'string' && left.startsWith(String(right)),
  ],
  [
    'endsWith',
    (left, right) => typeof left === 'string' && left.endsWith(String(right)),
  ],
  ['matches', matchesPattern],
]);

/**
 * Evaluate a comparison expression
 */
function evaluateComparison(
  expr: ComparisonExpression,
  context: ExecutionContext,
): boolean {
  const handler = comparisonHandlers.get(expr.operator);

  if (!handler) {
    throw new Error(`Unknown comparison operator: ${expr.operator}`);
  }

  return handler(
    evaluateExpression(expr.left, context),
    evaluateExpression(expr.right, context),
  );
}

// Only a safe pattern is compiled, so a template cannot stall the transition.
function matchesPattern(left: unknown, right: unknown): boolean {
  if (typeof left !== 'string' || typeof right !== 'string') {
    return false;
  }

  if (!safeRegex(right)) {
    logger.error('Unsafe regex pattern detected', { pattern: right });
    return false;
  }

  try {
    return new RegExp(right).test(left);
  } catch (error) {
    logger.error('Invalid regex pattern', { pattern: right, error });
    return false;
  }
}

/**
 * Evaluate logical expressions
 */
function evaluateLogical(
  expr: LogicalExpression,
  context: ExecutionContext,
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
  context: ExecutionContext,
): number {
  const values = expr.operands.map((op) => {
    const val = evaluateExpression(op, context);
    return typeof val === 'number' ? val : 0;
  });

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

type FunctionHandler = (args: unknown[]) => unknown;

const numberArguments = (args: unknown[]): number[] =>
  args.filter((value): value is number => typeof value === 'number');

const sumNumbers = (args: unknown[]): number =>
  numberArguments(args).reduce((sum, value) => sum + value, 0);

const firstNumber = (args: unknown[]): number =>
  typeof args[0] === 'number' ? args[0] : 0;

const firstString = (args: unknown[]): string =>
  typeof args[0] === 'string' ? args[0] : '';

const functionHandlers = new Map<string, FunctionHandler>([
  ['sum', sumNumbers],
  ['avg', (args) => (args.length === 0 ? 0 : sumNumbers(args) / args.length)],
  ['count', (args) => args.length],
  ['min', (args) => Math.min(...numberArguments(args))],
  ['max', (args) => Math.max(...numberArguments(args))],
  [
    'if',
    (args) => {
      if (args.length !== 3) {
        throw new Error('if function requires 3 arguments');
      }
      return args[0] ? args[1] : args[2];
    },
  ],
  ['coalesce', (args) => args.find((value) => value != null) ?? null],
  ['concat', (args) => args.map(String).join('')],
  [
    'length',
    (args) =>
      typeof args[0] === 'string' || Array.isArray(args[0])
        ? args[0].length
        : 0,
  ],
  ['abs', (args) => Math.abs(firstNumber(args))],
  ['round', (args) => Math.round(firstNumber(args))],
  ['floor', (args) => Math.floor(firstNumber(args))],
  ['ceil', (args) => Math.ceil(firstNumber(args))],
  ['toLowerCase', (args) => firstString(args).toLowerCase()],
  ['toUpperCase', (args) => firstString(args).toUpperCase()],
  ['trim', (args) => firstString(args).trim()],
]);

/**
 * Evaluate function calls
 */
function evaluateFunctionCall(
  expr: FunctionCallExpression,
  context: ExecutionContext,
): any {
  const handler = functionHandlers.get(expr.function);

  if (!handler) {
    throw new Error(`Unknown function: ${expr.function}`);
  }

  return handler(expr.arguments.map((arg) => evaluateExpression(arg, context)));
}

/**
 * Evaluate variable references
 */
function evaluateVariable(
  expr: VariableExpression,
  context: ExecutionContext,
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
