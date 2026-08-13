'use client';

import type { TemplateSection } from '@op/common/client';
import { sumMoneyFields } from '@op/common/client';
import { Surface } from '@op/ui/Surface';
import { useFormatter } from 'next-intl';
import type { ReactNode } from 'react';
import { useCallback } from 'react';

import { useTranslations } from '@/lib/i18n';

import { FieldHeader } from '../forms/FieldHeader';
import type { FieldDescriptor } from '../forms/types';

// ---------------------------------------------------------------------------
// Section shell
// ---------------------------------------------------------------------------

/**
 * A presentational criterion group: the section title in the serif heading
 * style (the same treatment as a criterion title such as "Overall
 * Recommendation"), its optional description, then its members rendered
 * exactly as they would be ungrouped.
 */
export function RubricSectionShell({
  section,
  children,
}: {
  section: TemplateSection;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <FieldHeader title={section.title} description={section.description} />
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Derived total
// ---------------------------------------------------------------------------

/**
 * Total row for a section that declares `showTotal` — the sum of its money
 * members' amounts, computed here at render time and never stored. Non-money
 * members are not summed.
 */
export function RubricSectionTotal({
  fields,
  answers,
}: {
  fields: FieldDescriptor[];
  answers: Record<string, unknown>;
}) {
  const t = useTranslations();
  const formatMoney = useMoneyFormatter();
  const { total, currency } = sumMoneyFields(fields, answers);

  return (
    <Surface
      variant="filled"
      className="flex items-center justify-between rounded-lg border-neutral-gray1 p-4"
    >
      <span className="text-base text-neutral-charcoal">{t('Total')}</span>
      <span className="font-serif !text-title-base text-neutral-black">
        {formatMoney(total ?? 0, currency)}
      </span>
    </Surface>
  );
}

// ---------------------------------------------------------------------------
// Currency formatting (via the i18n stack — no hand-rolled symbol map)
// ---------------------------------------------------------------------------

/** Formats an amount as currency in the active locale. */
export function useMoneyFormatter() {
  const format = useFormatter();

  return useCallback(
    (amount: number, currency: string) =>
      format.number(amount, { style: 'currency', currency }),
    [format],
  );
}
