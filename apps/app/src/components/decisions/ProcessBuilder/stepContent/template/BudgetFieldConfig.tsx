'use client';

import { FieldConfigCard } from '@op/ui/FieldConfigCard';
import { NumberField } from '@op/ui/NumberField';
import { Select, SelectItem } from '@op/ui/Select';
import { ToggleButton } from '@op/ui/ToggleButton';
import type { Key } from 'react';
import { useCallback } from 'react';
import { LuHash } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import {
  type ProposalTemplate,
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
  template: ProposalTemplate;
  onTemplateChange: React.Dispatch<React.SetStateAction<ProposalTemplate>>;
}) {
  const t = useTranslations();

  const budgetSchema = getFieldSchema(template, 'budget');
  const showBudget = !!budgetSchema;
  const budgetCurrency =
    (budgetSchema?.properties?.currency as { default?: string } | undefined)
      ?.default ?? 'USD';
  const budgetCurrencySymbol = CURRENCY_SYMBOL_MAP.get(budgetCurrency) ?? '$';
  const budgetMaxAmount = budgetSchema?.maximum as number | undefined;
  const budgetRequired = isFieldRequired(template, 'budget');

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
    (key: Key) => {
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
    <FieldConfigCard
      icon={LuHash}
      iconTooltip={t('Number')}
      label={t('Budget')}
      locked
    >
      <div className="space-y-4 px-8">
        <div className="flex items-center justify-between">
          <span className="text-neutral-charcoal">
            {t('Show in template?')}
          </span>
          <ToggleButton
            size="small"
            isSelected={showBudget}
            onChange={handleShowBudgetChange}
            aria-label={t('Show in template?')}
          />
        </div>
        {showBudget && (
          <>
            <Select
              label={t('Currency')}
              selectedKey={budgetCurrency}
              onSelectionChange={handleBudgetCurrencyChange}
              buttonClassName="bg-white"
            >
              {CURRENCIES.map((c) => (
                <SelectItem key={c.code} id={c.code}>
                  {c.code} {c.symbol}
                </SelectItem>
              ))}
            </Select>
            <NumberField
              label={t('Max budget')}
              value={budgetMaxAmount ?? null}
              onChange={handleBudgetMaxChange}
              prefixText={budgetCurrencySymbol}
              inputProps={{
                placeholder: t('Set maximum budget'),
              }}
            />
            <div className="flex items-center justify-between">
              <span className="text-neutral-charcoal">{t('Required?')}</span>
              <ToggleButton
                size="small"
                isSelected={budgetRequired}
                onChange={handleBudgetRequiredChange}
                aria-label={t('Required?')}
              />
            </div>
          </>
        )}
      </div>
    </FieldConfigCard>
  );
}
