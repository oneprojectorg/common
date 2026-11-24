import { moneyValueType } from './moneyValueType';
import type { ValueType } from './valueType';

/** Every value type an expression can combine. */
export const valueTypes: readonly ValueType<unknown>[] = [moneyValueType];
