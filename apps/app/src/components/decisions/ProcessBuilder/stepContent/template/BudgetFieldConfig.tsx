'use client';

import { ProposalTemplateSchema } from '@op/common';
import { CollapsibleConfigCard } from '@op/sense/CollapsibleConfigCard';
import { Field, FieldLabel } from '@op/sense/Field';
import { NumberField } from '@op/sense/NumberField';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@op/sense/Select';
import { Switch } from '@op/sense/Switch';
import { useLocale } from 'next-intl';
import type { Key } from 'react';
import { useCallback, useId, useMemo } from 'react';

import { useTranslations } from '@/lib/i18n';

import {
  getFieldSchema,
  isFieldRequired,
  setFieldRequired,
} from '../../../proposalTemplate';

const CURRENCIES = [
  { code: 'USD', symbol: '$' },
  { code: 'EUR', symbol: '€' },
  { code: 'GBP', symbol: '£' },
  { code: 'JPY', symbol: '¥' },
  { code: 'CAD', symbol: 'CA$' },
  { code: 'AUD', symbol: 'A$' },
  { code: 'CHF', symbol: 'CHF' },
  { code: 'CNY', symbol: '¥' },
  { code: 'INR', symbol: '₹' },
  { code: 'BRL', symbol: 'R$' },
  { code: 'KRW', symbol: '₩' },
  { code: 'SGD', symbol: 'S$' },
  { code: 'MXN', symbol: 'MX$' },
  { code: 'AED', symbol: 'د.إ' },
  { code: 'SAR', symbol: '﷼' },
] as const;

const CURRENCY_SYMBOL_MAP = new Map<string, string>(
  CURRENCIES.map((c) => [c.code, c.symbol]),
);

export function BudgetFieldConfig({
  template,
  onTemplateChange,
}: {
  template: ProposalTemplateSchema;
  onTemplateChange: React.Dispatch<
    React.SetStateAction<ProposalTemplateSchema>
  >;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const showInTemplateId = useId();
  const requiredId = useId();

  // Localized currency display name, e.g. "US Dollar (USD $)".
  const currencyName = useMemo(
    () => new Intl.DisplayNames([locale], { type: 'currency' }),
    [locale],
  );
  const currencyLabel = useCallback(
    (code: string, symbol: string) =>
      `${currencyName.of(code) ?? code} (${code} ${symbol})`,
    [currencyName],
  );
  const currencyItems = useMemo(
    () =>
      Object.fromEntries(
        CURRENCIES.map((c) => [c.code, currencyLabel(c.code, c.symbol)]),
      ),
    [currencyLabel],
  );

  const budgetSchema = getFieldSchema(template, 'budget');
  const showBudget = !!budgetSchema;
  const budgetCurrency =
    (budgetSchema?.properties?.currency as { default?: string } | undefined)
      ?.default ?? 'USD';
  const budgetCurrencySymbol = CURRENCY_SYMBOL_MAP.get(budgetCurrency) ?? '$';
  const budgetMaxAmount = budgetSchema?.maximum as number | undefined;
  const budgetRequired = isFieldRequired(template, 'budget');

  const badgeLabel = showBudget
    ? budgetRequired
      ? t('Required')
      : t('Optional')
    : undefined;

  const handleShowBudgetChange = useCallback(
    (show: boolean) => {
      if (show) {
        onTemplateChange((prev) => ({
          ...prev,
          properties: {
            ...prev.properties,
            budget: {
              type: 'object',
              title: t('Budget'),
              'x-format': 'money',
              properties: {
                amount: { type: 'number' },
                currency: { type: 'string', default: 'USD' },
              },
            },
          },
        }));
      } else {
        onTemplateChange((prev) => {
          const { budget: _, ...restProps } = prev.properties ?? {};
          const required = (prev.required ?? []).filter(
            (id) => id !== 'budget',
          );
          return {
            ...prev,
            properties: restProps,
            required: required.length > 0 ? required : undefined,
          };
        });
      }
    },
    [onTemplateChange, t],
  );

  const handleBudgetCurrencyChange = useCallback(
    (key: Key | null) => {
      if (key === null) {
        return;
      }
      onTemplateChange((prev) => {
        const existing = getFieldSchema(prev, 'budget');
        if (!existing) {
          return prev;
        }
        const existingProps = (existing.properties ?? {}) as Record<
          string,
          Record<string, unknown>
        >;
        return {
          ...prev,
          properties: {
            ...prev.properties,
            budget: {
              ...existing,
              properties: {
                ...existingProps,
                currency: {
                  ...(existingProps.currency ?? { type: 'string' }),
                  default: String(key),
                },
              },
            },
          },
        };
      });
    },
    [onTemplateChange],
  );

  const handleBudgetMaxChange = useCallback(
    (value: number | null) => {
      onTemplateChange((prev) => {
        const existing = getFieldSchema(prev, 'budget');
        if (!existing) {
          return prev;
        }
        const updated = { ...existing };
        if (value != null) {
          updated.maximum = value;
        } else {
          delete updated.maximum;
        }
        return {
          ...prev,
          properties: { ...prev.properties, budget: updated },
        };
      });
    },
    [onTemplateChange],
  );

  const handleBudgetRequiredChange = useCallback(
    (required: boolean) => {
      onTemplateChange((prev) => setFieldRequired(prev, 'budget', required));
    },
    [onTemplateChange],
  );

  return (
    <CollapsibleConfigCard
      label={t('Funding amount')}
      badgeLabel={badgeLabel}
      isCollapsible
      locked
    >
      <div className="space-y-4">
        {showBudget && (
          <>
            <Field>
              <FieldLabel htmlFor="budget-currency">{t('Currency')}</FieldLabel>
              <Select
                value={budgetCurrency}
                onValueChange={(currency) =>
                  handleBudgetCurrencyChange(currency)
                }
                items={currencyItems}
              >
                <SelectTrigger id="budget-currency" className="w-full bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {currencyLabel(c.code, c.symbol)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <NumberField
              id="budget-max"
              label={t('Max amount')}
              prefixText={budgetCurrencySymbol}
              placeholder={t('Set maximum amount')}
              value={budgetMaxAmount ?? null}
              onChange={handleBudgetMaxChange}
            />
          </>
        )}
        {/* Required? (left) and Show in template? (right) share one row. */}
        <div className="flex items-center justify-between gap-4 pt-2">
          {showBudget ? (
            <Field orientation="horizontal" className="w-auto">
              <FieldLabel htmlFor={requiredId}>{t('Required?')}</FieldLabel>
              <Switch
                id={requiredId}
                checked={budgetRequired}
                onCheckedChange={handleBudgetRequiredChange}
                aria-label={t('Required?')}
              />
            </Field>
          ) : (
            <span />
          )}
          <Field orientation="horizontal" className="w-auto">
            <FieldLabel htmlFor={showInTemplateId}>
              {t('Show in template?')}
            </FieldLabel>
            <Switch
              id={showInTemplateId}
              checked={showBudget}
              onCheckedChange={handleShowBudgetChange}
              aria-label={t('Show in template?')}
              data-testid="budget-show-in-template-toggle"
            />
          </Field>
        </div>
      </div>
    </CollapsibleConfigCard>
  );
}
