/** The operators a value type can implement, each as an optional method. */
export const valueTypeOperators = ['add'] as const satisfies readonly Exclude<
  keyof ValueType<unknown>,
  'parse'
>[];

/**
 * A kind of value that an expression can combine when it is not a plain
 * number. `parse` accepts only a value of this type, and gives undefined for
 * any other value.
 */
// Method syntax, so a `ValueType<MoneyAmount>` fits a registry of
// `ValueType<unknown>`: the evaluator passes to an operation only what `parse`
// gave.
export type ValueType<T> = {
  parse(value: unknown): T | undefined;
  /** Undefined when the two values cannot be combined. */
  add?(a: T, b: T): T | undefined;
};
