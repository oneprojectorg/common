'use client';

import { useCollaborativeFragment } from '@/hooks/useCollaborativeFragment';
import type { BudgetData } from '@op/common/client';
import { Button } from '@op/ui/Button';
import { NumberField } from '@op/ui/NumberField';
import { useEffect, useRef, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { useCollaborativeDoc } from './CollaborativeDocContext';

const DEFAULT_CURRENCY = 'USD';
const DEFAULT_CURRENCY_SYMBOL = '$';

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: DEFAULT_CURRENCY_SYMBOL,
};

interface CollaborativeBudgetFieldProps {
  maxAmount?: number;
  initialValue?: BudgetData | null;
  onChange?: (budget: BudgetData | null) => void;
}

/**
 * Collaborative budget input synced via Yjs XmlFragment.
 * Stores `MoneyAmount` (`{ amount, currency }`) as a JSON string in the shared doc
 * for future multi-currency support.
 *
 * Displays as a pill when a value exists or empty, switching to an inline
 * NumberField on click for editing. The pill width matches the input width
 * to prevent layout shifts.
 */
export function CollaborativeBudgetField({
  maxAmount,
  initialValue = null,
  onChange,
}: CollaborativeBudgetFieldProps) {
  const t = useTranslations();
  const { ydoc } = useCollaborativeDoc();
  const budgetInputRef = useRef<HTMLInputElement>(null);

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

  const [isEditing, setIsEditing] = useState(false);
  const budgetAmount = budget?.amount ?? null;
  const currencySymbol =
    CURRENCY_SYMBOLS[budget?.currency ?? DEFAULT_CURRENCY] ??
    DEFAULT_CURRENCY_SYMBOL;

  // Track the NumberField width so the pill button can match it
  const [fieldWidth, setFieldWidth] = useState(0);

  // Auto-focus when switching to edit mode, and measure the field width
  // after the NumberField's internal effects have settled
  useEffect(() => {
    if (isEditing && budgetInputRef.current) {
      budgetInputRef.current.focus();
      // Defer measurement so NumberField's value and prefix effects settle
      const frame = requestAnimationFrame(() => {
        const group = budgetInputRef.current?.closest('[role="group"]');
        if (group instanceof HTMLElement && group.offsetWidth > 0) {
          setFieldWidth(group.offsetWidth);
        }
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [isEditing]);

  const handleChange = (value: number | null) => {
    if (value === null) {
      setBudget(null);
    } else {
      setBudget({
        currency: budget?.currency ?? DEFAULT_CURRENCY,
        amount: value,
      });
    }
  };

  useEffect(() => {
    const emitted: BudgetData | null = budget;
    const key = emitted ? `${emitted.amount}:${emitted.currency}` : null;

    if (lastEmittedRef.current === key) {
      return;
    }

    lastEmittedRef.current = key ?? undefined;
    onChangeRef.current?.(emitted);
  }, [budget]);

  const handleStartEditing = () => {
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <NumberField
        ref={budgetInputRef}
        value={budgetAmount}
        onChange={handleChange}
        prefixText={currencySymbol}
        inputProps={{
          placeholder: maxAmount
            ? t('Max {amount}', { amount: maxAmount.toLocaleString() })
            : t('Enter amount'),
          onBlur: handleBlur,
          className: 'shadow-none',
        }}
        fieldClassName="w-auto rounded-md"
      />
    );
  }

  return (
    <Button
      variant="pill"
      color="pill"
      onPress={handleStartEditing}
      className="justify-start text-left"
      style={fieldWidth > 0 ? { minWidth: fieldWidth } : undefined}
    >
      {budgetAmount !== null
        ? `${currencySymbol}${budgetAmount.toLocaleString()}`
        : t('Add budget')}
    </Button>
  );
}
