import { readJsonPointer } from './jsonPointer';
import type { MappingExpression } from './types';

type ArithmeticOperator = 'add' | 'subtract' | 'multiply' | 'divide';

/**
 * Evaluates a mapping expression against one source's data. Returns undefined
 * when the expression has no value; a missing operand never counts as zero.
 */
export const evaluateMappingExpression = ({
  expression,
  data,
}: {
  expression: MappingExpression;
  data: unknown;
}): unknown => {
  if ('pointer' in expression) {
    const value = readJsonPointer({ data, pointer: expression.pointer });
    return value === null || value === '' ? undefined : value;
  }
  if ('value' in expression) {
    return expression.value;
  }
  if ('operator' in expression) {
    const numbers = evaluateNumbers({ expressions: expression.operands, data });
    return numbers
      ? applyOperator({ operator: expression.operator, numbers })
      : undefined;
  }

  switch (expression.function) {
    case 'sum': {
      const numbers = evaluateNumbers({
        expressions: expression.arguments,
        data,
      });
      return numbers ? applyOperator({ operator: 'add', numbers }) : undefined;
    }
    case 'round': {
      if (expression.arguments.length !== 1) {
        return undefined;
      }
      const [number] =
        evaluateNumbers({ expressions: expression.arguments, data }) ?? [];
      return number === undefined ? undefined : Math.round(number);
    }
    case 'concat':
      return concatenate({ expressions: expression.arguments, data });
    case 'coalesce':
      for (const argument of expression.arguments) {
        const value = evaluateMappingExpression({ expression: argument, data });
        if (value !== undefined) {
          return value;
        }
      }
      return undefined;
  }
};

const evaluateNumbers = ({
  expressions,
  data,
}: {
  expressions: MappingExpression[];
  data: unknown;
}): number[] | undefined => {
  const numbers: number[] = [];
  for (const expression of expressions) {
    const value = evaluateMappingExpression({ expression, data });
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return undefined;
    }
    numbers.push(value);
  }
  return numbers;
};

const applyOperator = ({
  operator,
  numbers,
}: {
  operator: ArithmeticOperator;
  numbers: number[];
}): number | undefined => {
  const [first, ...rest] = numbers;
  if (first === undefined) {
    return undefined;
  }
  if (operator === 'divide' && rest.includes(0)) {
    return undefined;
  }

  const result = rest.reduce((accumulator, operand) => {
    switch (operator) {
      case 'add':
        return accumulator + operand;
      case 'subtract':
        return accumulator - operand;
      case 'multiply':
        return accumulator * operand;
      case 'divide':
        return accumulator / operand;
    }
  }, first);
  return Number.isFinite(result) ? result : undefined;
};

const concatenate = ({
  expressions,
  data,
}: {
  expressions: MappingExpression[];
  data: unknown;
}): string | undefined => {
  const parts: string[] = [];
  for (const expression of expressions) {
    const value = evaluateMappingExpression({ expression, data });
    if (typeof value === 'string') {
      parts.push(value);
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      parts.push(String(value));
    } else {
      return undefined;
    }
  }
  return parts.join('');
};
