export const valueTypeOperators = ['add'] as const satisfies readonly Exclude<
  keyof ValueType<unknown>,
  'parse'
>[];

type ValueTypeOperator = (typeof valueTypeOperators)[number];

export const isValueTypeOperator = (
  operator: string,
): operator is ValueTypeOperator =>
  valueTypeOperators.some((name) => name === operator);

// Method syntax is bivariant, so a `ValueType<MoneyAmount>` fits a registry of
// `ValueType<unknown>`; an operation only gets what `parse` gave.
export type ValueType<T> = {
  parse(value: unknown): T | undefined;
  /** Undefined when the two values cannot be combined. */
  add?(a: T, b: T): T | undefined;
};
