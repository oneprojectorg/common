import { moneyValueType } from './moneyValueType';
import type { ValueType } from './valueType';

export const valueTypes: readonly ValueType<unknown>[] = [moneyValueType];
