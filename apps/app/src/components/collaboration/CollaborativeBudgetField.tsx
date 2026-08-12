'use client';

import { useCollaborativeFragment } from '@/hooks/useCollaborativeFragment';
import {
  formatAmount,
  formatMoney,
  getCurrencySymbol,
} from '@/utils/formatting';
import {
  DEFAULT_BUDGET_CURRENCY,
  type StoredBudget,
  parseBudgetFragmentValue,
  parseStoredBudgetFragmentValue,
  withStoredBudgetCurrency,
} from '@op/common/client';
import { Button } from '@op/ui/Button';
import { NumberField } from '@op/ui/NumberField';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { useCollaborativeDoc } from './CollaborativeDocContext';

interface CollaborativeBudgetFieldProps {
  minAmount?: number;
  maxAmount?: number;
  /**
   * ISO 4217 code to *display* a fragment that names none of its own with.
   * Display only: it is never written into the fragment or emitted through
   * `onChange`, so a budget that named no currency keeps naming none and
   * follows the process's if that later changes.
   *
   * Already resolved by the caller through `resolveBudgetFallbackCurrency` —
   * this component must not re-derive it from `initialValue`, whose currency is
   * absent for a budget that named none and so says nothing about which one the
   * process is denominated in.
   */
  currency?: string;
  initialValue?: StoredBudget | null;
  onChange?: (budget: StoredBudget | null) => void;
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
  currency: fallbackCurrency = DEFAULT_BUDGET_CURRENCY,
  initialValue = null,
  onChange,
}: CollaborativeBudgetFieldProps) {
  const t = useTranslations();
  const { ydoc } = useCollaborativeDoc();
  const budgetInputRef = useRef<HTMLInputElement>(null);

  // Seeded with the stored currency or with none at all — never with the
  // resolved fallback. Every renderer reads the currency back off this
  // fragment, so seeding a resolved code would pin the proposal to whatever
  // was resolved the first time somebody opened the editor, and a later change
  // to the process's currency would silently skip this proposal. `||` rather
  // than `??` because a blank stored code names no currency either.
  const [budgetText, setBudgetText] = useCollaborativeFragment(
    ydoc,
    'budget',
    initialValue !== null
      ? JSON.stringify(
          initialValue.currency
            ? { currency: initialValue.currency, amount: initialValue.amount }
            : { amount: initialValue.amount },
        )
      : '',
  );

  // Same parser the cards and detail page read the fragment with, so the
  // editor can't show "Add budget" for a legacy fragment they render a value
  // for. `undefined` means present-but-unreadable as well as absent.
  //
  // Memoized so the emit effect below can depend on it directly: one parse
  // makes "display and emit agree" structural rather than something the next
  // reader has to keep true by hand.
  const budget = useMemo(
    () => parseBudgetFragmentValue(budgetText, fallbackCurrency),
    [budgetText, fallbackCurrency],
  );
  // What the fragment itself names, which is what gets written back to it: the
  // resolved `budget` above is for display only.
  const fragmentBudget = useMemo(
    () => parseStoredBudgetFragmentValue(budgetText),
    [budgetText],
  );
  // What a save would write to the proposal row. The fragment is the amount's
  // source of truth but not the currency's — it names one only when whoever
  // wrote it filled one in — so a currency already stored on the proposal
  // carries across rather than being deleted by an amount edit.
  const storedCurrency = initialValue?.currency;
  const budgetToPersist = useMemo(
    () => withStoredBudgetCurrency(fragmentBudget, storedCurrency) ?? null,
    [fragmentBudget, storedCurrency],
  );
  const setBudget = (newBudget: StoredBudget | null) =>
    setBudgetText(newBudget ? JSON.stringify(newBudget) : '');

  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const [isEditing, setIsEditing] = useState(false);
  const budgetAmount = budget?.amount ?? null;
  const currency = budget?.currency ?? fallbackCurrency;
  const currencySymbol = useMemo(() => getCurrencySymbol(currency), [currency]);

  const placeholderText = maxAmount
    ? t('Max {amount}', { amount: formatAmount(maxAmount) })
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
      return;
    }
    // Keeps the fragment's own currency when it has one and writes none when
    // it doesn't — this field has no currency control, so typing an amount is
    // not a choice of currency and must not record one.
    setBudget(
      fragmentBudget?.currency
        ? { currency: fragmentBudget.currency, amount: value }
        : { amount: value },
    );
  };

  useEffect(() => {
    // A fragment we can't read means "unknown", not "cleared". This effect
    // fires on mount, and `useProposalDraft` treats a `null` budget as the
    // author emptying the field — so emitting here would autosave the stored
    // budget away just because someone opened the proposal. Clearing the
    // field deletes the fragment, which arrives as empty text, not as
    // unreadable text.
    if (budgetText && !budget) {
      return;
    }

    // Compared against the parent's *current* value rather than a ref of what
    // we last sent. `useProposalDraft` resets `draft` to the refetched server
    // proposal, and a ref would still hold the pre-reset key and suppress the
    // re-emit — letting the next save write the stale server budget over the
    // newer one the author can see in the fragment.
    //
    // Against what a save would actually write, so the two can't drift: an
    // amount edit emits, and so does a fragment that names a *different*
    // currency than the row (the editor pill would otherwise read €5,000
    // forever while every other surface kept reading $5,000). Comparing the
    // resolved `budget` instead would emit whenever the fragment merely names
    // none — pinning the proposal to a fallback nobody chose, merely because
    // it was opened.
    if (
      budgetToPersist?.amount === initialValue?.amount &&
      budgetToPersist?.currency === storedCurrency
    ) {
      return;
    }

    onChangeRef.current?.(budgetToPersist);
  }, [
    budgetText,
    budget,
    budgetToPersist,
    initialValue?.amount,
    storedCurrency,
  ]);

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
          className="justify-start text-start"
        >
          {budgetAmount !== null
            ? formatMoney({ amount: budgetAmount, currency })
            : t('Add budget')}
        </Button>
      )}
    </>
  );
}
