'use client';

import { useCollaborativeFragment } from '@/hooks/useCollaborativeFragment';
import type { BudgetData } from '@op/common/client';
import { Button } from '@op/ui/Button';
import { NumberField } from '@op/ui/NumberField';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

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
  minAmount?: number;
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
  minAmount,
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
  const budgetKey = budget ? `${budget.amount}:${budget.currency}` : null;
  const setBudget = (newBudget: BudgetData | null) =>
    setBudgetText(newBudget ? JSON.stringify(newBudget) : '');

  const onChangeRef = useRef(onChange);
  const lastEmittedRef = useRef<string | null>(budgetKey);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const [isEditing, setIsEditing] = useState(false);
  const budgetAmount = budget?.amount ?? null;
  const currency = budget?.currency ?? DEFAULT_CURRENCY;
  const currencySymbol = useMemo(() => getCurrencySymbol(currency), [currency]);

  const placeholderText = maxAmount
    ? t('Max {amount}', { amount: maxAmount.toLocaleString() })
    : t('Enter amount');

  // Size the input to its placeholder text instead of the default size=20
  useLayoutEffect(() => {
    if (budgetInputRef.current) {
      budgetInputRef.current.size = placeholderText.length;
    }
  }, [placeholderText]);

  // Use the larger of the input and button natural widths so both match
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [sharedWidth, setSharedWidth] = useState(0);

  useEffect(() => {
    if (isEditing) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      const group = budgetInputRef.current?.closest('[role="group"]');
      const inputW = group instanceof HTMLElement ? group.offsetWidth : 0;
      const buttonW = buttonRef.current?.scrollWidth ?? 0;
      const width = Math.max(inputW, buttonW);
      if (width > 0) {
        setSharedWidth(width);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [isEditing]);

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
        currency,
        amount: value,
      });
    }
  };

  useEffect(() => {
    if (lastEmittedRef.current === budgetKey) {
      return;
    }

    lastEmittedRef.current = budgetKey;
    onChangeRef.current?.(budget);
  }, [budget, budgetKey]);

  const handleStartEditing = () => {
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
  };

  return (
    <>
      <div
        className={
          isEditing ? 'max-w-md' : 'pointer-events-none absolute opacity-0'
        }
        style={sharedWidth > 0 ? { minWidth: sharedWidth } : undefined}
      >
        <NumberField
          ref={budgetInputRef}
          value={budgetAmount}
          onChange={handleChange}
          minValue={minAmount ?? 0}
          maxValue={maxAmount}
          prefixText={currencySymbol}
          inputProps={{
            placeholder: placeholderText,
            onBlur: handleBlur,
            className: 'shadow-none',
          }}
          fieldClassName="rounded-lg"
        />
      </div>
      {!isEditing && (
        <Button
          ref={buttonRef}
          variant="pill"
          color="pill"
          onPress={handleStartEditing}
          className="justify-start text-left"
        >
          {budgetAmount !== null
            ? budgetAmount.toLocaleString(undefined, {
                style: 'currency',
                currency,
                currencyDisplay: 'narrowSymbol',
                maximumFractionDigits: 0,
              })
            : t('Add budget')}
        </Button>
      )}
    </>
  );
}
