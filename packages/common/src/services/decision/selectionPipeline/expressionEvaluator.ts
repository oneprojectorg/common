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
 * Access a field using dot notation
 */
function evaluateFieldAccess(
  expr: FieldAccessExpression,
  context: ExecutionContext,
): any {
  const path = expr.field.split('.');
  let current: any = context.proposal || context;

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
  context: ExecutionContext,
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
            console.error(`Unsafe regex pattern detected: ${right}`);
            return false;
          }
          const regex = new RegExp(right);
          return regex.test(left);
        } catch (error) {
          // Invalid regex pattern
          console.error(`Invalid regex pattern: ${right}`, error);
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

/**
 * Evaluate function calls
 */
function evaluateFunctionCall(
  expr: FunctionCallExpression,
  context: ExecutionContext,
): any {
  const args = expr.arguments.map((arg) => evaluateExpression(arg, context));

  switch (expr.function) {
    case 'sum':
      return args.reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0);

    case 'avg':
      if (args.length === 0) {
        return 0;
      }
      const sum = args.reduce(
        (s, val) => s + (typeof val === 'number' ? val : 0),
        0,
      );
      return sum / args.length;

    case 'count':
      return args.length;

    case 'min':
      return Math.min(...args.filter((v) => typeof v === 'number'));

    case 'max':
      return Math.max(...args.filter((v) => typeof v === 'number'));

    case 'if':
      // if(condition, trueValue, falseValue)
      if (args.length !== 3) {
        throw new Error('if function requires 3 arguments');
      }
      return args[0] ? args[1] : args[2];

    case 'coalesce':
      // Return first non-null value
      return args.find((v) => v != null) ?? null;

    case 'concat':
      return args.map(String).join('');

    case 'length':
      if (args.length === 0) {
        return 0;
      }
      const val = args[0];
      if (typeof val === 'string' || Array.isArray(val)) {
        return val.length;
      }
      return 0;

    case 'abs':
      return args.length > 0 && typeof args[0] === 'number'
        ? Math.abs(args[0])
        : 0;

    case 'round':
      return args.length > 0 && typeof args[0] === 'number'
        ? Math.round(args[0])
        : 0;

    case 'floor':
      return args.length > 0 && typeof args[0] === 'number'
        ? Math.floor(args[0])
        : 0;

    case 'ceil':
      return args.length > 0 && typeof args[0] === 'number'
        ? Math.ceil(args[0])
        : 0;

    case 'toLowerCase':
      return args.length > 0 && typeof args[0] === 'string'
        ? args[0].toLowerCase()
        : '';

    case 'toUpperCase':
      return args.length > 0 && typeof args[0] === 'string'
        ? args[0].toUpperCase()
        : '';

    case 'trim':
      return args.length > 0 && typeof args[0] === 'string' ? args[0].trim() : '';

    default:
      throw new Error(`Unknown function: ${expr.function}`);
  }
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

/**
 * Helper to set a value in an object using dot notation
 */
export function setValueByPath(obj: any, path: string, value: any): void {
  const parts = path.split('.');
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!part) {
      continue;
    }
    if (!(part in current) || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part];
  }

  const lastPart = parts[parts.length - 1];
  if (lastPart) {
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
    if (current == null) {
      return null;
    }
    current = current[part];
  }

  return current;
}
