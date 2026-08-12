'use client';

import { formatCurrency } from '@/utils/formatting';
import { Surface } from '@op/ui/Surface';

import { useTranslations } from '@/lib/i18n';

/**
 * Derived total of a budget add-up: the filled row under its money line
 * items, shown live in the reviewer form and again on the submitted review.
 * Totals are never stored — every caller passes a freshly summed value.
 */
export function MoneyTotalRow({
  total,
  currency,
}: {
  total: number;
  currency: string;
}) {
  const t = useTranslations();

  return (
    <Surface
      variant="filled"
      className="flex items-center justify-between rounded-lg border-neutral-gray1 p-4"
    >
      <span className="text-base text-neutral-charcoal">{t('Total')}</span>
      <span className="font-serif text-title-base text-neutral-black">
        {formatCurrency(total, undefined, currency, {
          minimumFractionDigits: 2,
        })}
      </span>
    </Surface>
  );
}
