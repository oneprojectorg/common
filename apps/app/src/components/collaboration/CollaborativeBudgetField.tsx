'use client';

import { useCollaborativeFragment } from '@/hooks/useCollaborativeFragment';
import type { BudgetData } from '@op/common/client';
import { NumberField } from '@op/sense/NumberField';
import { useEffect, useMemo, useRef } from 'react';

import { useTranslations } from '@/lib/i18n';

import { useCollaborativeDoc } from './CollaborativeDocContext';

const DEFAULT_CURRENCY = 'USD';

const getCurrencySymbol = (currency: string) =>
  (0)
    .toLocaleString(undefined, {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
    .replace(/\d/g, '')
    .trim();

interface CollaborativeBudgetFieldProps {
  /** Visible field label. Falls back to "Funding amount". */
  title?: string;
  description?: string;
  required?: boolean;
  minAmount?: number;
  maxAmount?: number;
  initialValue?: BudgetData | null;
  onChange?: (budget: BudgetData | null) => void;
  /** Renders the input non-interactive while keeping its label and value visible. */
  disabled?: boolean;
}

/**
 * Collaborative budget input synced via Yjs XmlFragment.
 * Stores `MoneyAmount` (`{ amount, currency }`) as a JSON string in the shared doc
 * for future multi-currency support.
 *
 * Rendered as a permanently-visible labelled number input with a currency-symbol
 * addon, at half the form column's width (Figma: 272 of 544).
 */
export function CollaborativeBudgetField({
  title,
  description,
  required = false,
  minAmount,
  maxAmount,
  initialValue = null,
  onChange,
  disabled = false,
}: CollaborativeBudgetFieldProps) {
  const t = useTranslations();
  const { ydoc } = useCollaborativeDoc();

  const initialBudgetValue =
    initialValue !== null
      ? { currency: initialValue.currency, amount: initialValue.amount }
      : null;

  const [budgetText, setBudgetText] = useCollaborativeFragment(
    ydoc,
    'budget',
    initialBudgetValue ? JSON.stringify(initialBudgetValue) : '',
  );

  const budget = budgetText ? (JSON.parse(budgetText) as BudgetData) : null;
  const setBudget = (newBudget: BudgetData | null) =>
    setBudgetText(newBudget ? JSON.stringify(newBudget) : '');

  const onChangeRef = useRef(onChange);
  const lastEmittedRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const budgetAmount = budget?.amount ?? null;
  const currency = budget?.currency ?? DEFAULT_CURRENCY;
  const currencySymbol = useMemo(() => getCurrencySymbol(currency), [currency]);

  const placeholderText = maxAmount
    ? t('Max {amount}', { amount: maxAmount.toLocaleString() })
    : t('Enter amount');

  const handleChange = (value: number | null) => {
    if (value === null) {
      setBudget(null);
    } else {
      setBudget({
        currency,
        amount: value,
      });
    }
  };

  useEffect(() => {
    const emitted = budgetText ? (JSON.parse(budgetText) as BudgetData) : null;
    const key = emitted ? `${emitted.amount}:${emitted.currency}` : null;

    if (lastEmittedRef.current === key) {
      return;
    }

    lastEmittedRef.current = key ?? undefined;
    onChangeRef.current?.(emitted);
  }, [budgetText]);

  return (
    <NumberField
      label={title ?? t('Funding amount')}
      description={description}
      required={required}
      aria-required={required || undefined}
      disabled={disabled}
      value={budgetAmount}
      onChange={handleChange}
      minValue={minAmount ?? 0}
      maxValue={maxAmount}
      prefixText={currencySymbol}
      placeholder={placeholderText}
      // Figma: half the 544 column (272px = 17rem).
      className="w-full gap-2 sm:max-w-68"
    />
  );
}
