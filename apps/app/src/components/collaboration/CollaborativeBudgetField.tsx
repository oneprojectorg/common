'use client';

import { useCollaborativeFragment } from '@/hooks/useCollaborativeFragment';
import { Button } from '@op/ui/Button';
import { NumberField } from '@op/ui/NumberField';
import { useEffect, useRef, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { useCollaborativeDoc } from './CollaborativeDocContext';

/**
 * Yjs-synced budget shape — currency + amount as an atomic value
 * TODO: the backend part will be done separately once we have more clarity how it's going to be used.
 */
interface BudgetValue {
  currency: string;
  amount: number;
}

const DEFAULT_CURRENCY = 'USD';
const DEFAULT_CURRENCY_SYMBOL = '$';

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: DEFAULT_CURRENCY_SYMBOL,
};

/** Formats a number as a locale-aware currency string (e.g. 5000 → "$5,000") */
function formatBudgetDisplay(amount: number, currencySymbol: string): string {
  return `${currencySymbol}${amount.toLocaleString()}`;
}

interface CollaborativeBudgetFieldProps {
  budgetCapAmount?: number;
  initialValue?: number | null;
  onChange?: (budget: number | null) => void;
}

/**
 * Collaborative budget input synced via Yjs XmlFragment.
 * Stores `{ currency, amount }` as a JSON string in the shared doc
 * for future multi-currency support.
 *
 * Displays as a pill when a value exists, switching to an inline
 * NumberField on click for editing.
 */
export function CollaborativeBudgetField({
  budgetCapAmount,
  initialValue = null,
  onChange,
}: CollaborativeBudgetFieldProps) {
  const t = useTranslations();
  const { ydoc } = useCollaborativeDoc();
  const budgetInputRef = useRef<HTMLInputElement>(null);

  const initialBudgetValue =
    initialValue !== null
      ? { currency: DEFAULT_CURRENCY, amount: initialValue }
      : null;

  const [budgetText, setBudgetText] = useCollaborativeFragment(
    ydoc,
    'budget',
    initialBudgetValue ? JSON.stringify(initialBudgetValue) : '',
  );

  const budget = budgetText ? (JSON.parse(budgetText) as BudgetValue) : null;
  const setBudget = (value: BudgetValue | null) =>
    setBudgetText(value ? JSON.stringify(value) : '');

  const onChangeRef = useRef(onChange);
  const lastEmittedAmountRef = useRef<number | null | undefined>(undefined);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const [isEditing, setIsEditing] = useState(false);
  const budgetAmount = budget?.amount ?? null;
  const currencySymbol =
    CURRENCY_SYMBOLS[budget?.currency ?? DEFAULT_CURRENCY] ??
    DEFAULT_CURRENCY_SYMBOL;

  // Auto-focus when switching to edit mode
  useEffect(() => {
    if (isEditing && budgetInputRef.current) {
      budgetInputRef.current.focus();
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
    if (lastEmittedAmountRef.current === budgetAmount) {
      return;
    }

    lastEmittedAmountRef.current = budgetAmount;
    onChangeRef.current?.(budgetAmount);
  }, [budgetAmount]);

  const handleStartEditing = () => {
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
  };

  // No value and not editing → "Add budget" pill
  if (budgetAmount === null && !isEditing) {
    return (
      <Button variant="pill" color="pill" onPress={handleStartEditing}>
        {t('Add budget')}
      </Button>
    );
  }

  // Has a value and not editing → display as pill
  if (budgetAmount !== null && !isEditing) {
    return (
      <Button variant="pill" color="pill" onPress={handleStartEditing}>
        {formatBudgetDisplay(budgetAmount, currencySymbol)}
      </Button>
    );
  }

  // Editing mode → inline NumberField
  return (
    <NumberField
      ref={budgetInputRef}
      value={budgetAmount}
      onChange={handleChange}
      prefixText={currencySymbol}
      inputProps={{
        placeholder: budgetCapAmount
          ? t('Max {amount}', {
              amount: budgetCapAmount.toLocaleString(),
            })
          : t('Enter amount'),
        onBlur: handleBlur,
      }}
      fieldClassName="w-auto"
    />
  );
}
