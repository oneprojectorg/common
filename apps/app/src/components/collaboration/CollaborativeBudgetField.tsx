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
  parseStoredBudgetFragmentValue,
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

  // What the fragment itself names, read with the same parser the cards and
  // detail page use, so the editor can't show "Add budget" for a legacy
  // fragment they render a value for. `undefined` means present-but-unreadable
  // as well as absent.
  const fragmentBudget = useMemo(
    () => parseStoredBudgetFragmentValue(budgetText),
    [budgetText],
  );
  // The code the proposal row itself stores, if any. Blank counts as none,
  // matching every other reader.
  //
  // Latched rather than read straight off the prop, because `initialValue` is
  // the live *draft*, not the row: clearing the field emits `null`, which sets
  // `draft.budget` to `null`, so re-reading the prop after a clear says the
  // proposal names no currency. Clearing and retyping an amount then saved
  // `{amount}` alone and deleted a stored "EUR" — an author with no currency
  // control changing the proposal's currency, which is exactly what this field
  // must never do. Nothing clears the latch: the only way a proposal stops
  // naming a currency is a writer that has one to offer.
  const storedCurrencyRef = useRef<string | undefined>(undefined);
  const rowCurrency = initialValue?.currency?.trim();
  if (rowCurrency) {
    storedCurrencyRef.current = rowCurrency;
  }
  const storedCurrency = storedCurrencyRef.current;
  // What a save would write to the proposal row: the fragment's amount, under
  // the currency the row already stores.
  //
  // This field has no currency control, so it must never *change* the row's
  // currency — not to the fragment's, and not to a resolved one. Pre-branch
  // editors stamped `"currency":"USD"` into every fragment they wrote, so
  // adopting the fragment's would re-persist a fabricated code onto a process
  // denominated in something else, on mount, without the author touching
  // anything — the exact bug this branch set out to fix, baked into the row.
  // Carrying the stored code across is the other half: an amount edit must not
  // delete a currency the proposal had named.
  const budgetToPersist = useMemo(
    () =>
      fragmentBudget
        ? {
            amount: fragmentBudget.amount,
            ...(storedCurrency ? { currency: storedCurrency } : {}),
          }
        : null,
    [fragmentBudget, storedCurrency],
  );
  const setBudget = (newBudget: StoredBudget | null) =>
    setBudgetText(newBudget ? JSON.stringify(newBudget) : '');

  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const [isEditing, setIsEditing] = useState(false);
  const budgetAmount = fragmentBudget?.amount ?? null;
  // `||`, not `??`: a blank stored code names no currency either.
  const currency = fragmentBudget?.currency || fallbackCurrency;
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
      // Emitted from here rather than from the sync effect below, because only
      // this path knows the author *cleared* the field: an empty fragment on
      // its own is ambiguous, and a document that simply never carried a
      // budget looks exactly the same.
      onChangeRef.current?.(null);
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

  // Keeps the row's amount in step with the fragment, which is the amount's
  // source of truth — including on mount, where it repairs a row still holding
  // a creation-time figure the author has since edited.
  useEffect(() => {
    // The fragment carries no budget we can read: either empty, or text no
    // reader can make a budget out of. Neither is "the author cleared it", so
    // leave the row's budget standing — this effect fires on mount, and
    // `useProposalDraft` treats a `null` budget as the author emptying the
    // field, so emitting here would autosave the stored budget away just
    // because someone opened a proposal whose document never carried one.
    // Clearing is a local action and emits from `handleChange`.
    if (!budgetToPersist) {
      return;
    }

    // Compared against the parent's *current* value rather than a ref of what
    // we last sent. `useProposalDraft` resets `draft` to the refetched server
    // proposal, and a ref would still hold the pre-reset value and suppress the
    // re-emit — letting the next save write the stale server budget over the
    // newer one the author can see in the fragment.
    //
    // Amount only: `budgetToPersist` carries the row's own currency by
    // construction, so there is never a currency difference to emit for.
    if (budgetToPersist.amount === initialValue?.amount) {
      return;
    }

    onChangeRef.current?.(budgetToPersist);
  }, [budgetToPersist, initialValue?.amount]);

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
