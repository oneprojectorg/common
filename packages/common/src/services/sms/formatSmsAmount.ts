import type { AmountUnit } from '@op/types/amountUnit';

import { getUnitLabel } from '../decision/fieldUnit';

const grouped = (amount: number): string =>
  amount.toLocaleString('en-US', { maximumFractionDigits: 10 });

export const formatSmsAmount = ({
  amount,
  unit,
}: {
  amount: number;
  unit: AmountUnit;
}): string =>
  unit.kind === 'currency'
    ? `${getUnitLabel(unit)}${grouped(amount)}`
    : `${grouped(amount)} ${getUnitLabel(unit)}`;
