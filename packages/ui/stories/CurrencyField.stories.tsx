import type { Meta } from '@storybook/react-vite';
import { useState } from 'react';
import { I18nProvider } from 'react-aria';

import { CurrencyField } from '../src/components/CurrencyField';

const meta: Meta<typeof CurrencyField> = {
  title: 'Legacy/CurrencyField',
  component: CurrencyField,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  args: {
    label: 'Design & Engineering Cost',
    currency: 'USD',
  },
};

export default meta;

export const Example = () => (
  <div className="flex w-96 flex-col gap-8">
    <CurrencyField
      label="Empty state"
      currency="USD"
      inputProps={{ placeholder: '$0.00' }}
    />
    <CurrencyField label="With value" currency="USD" value={42000} />
    <CurrencyField
      label="Required"
      currency="USD"
      isRequired
      description="Helper text"
    />
    <CurrencyField
      label="With a minimum"
      currency="USD"
      minValue={0}
      value={-5}
    />
    <CurrencyField label="Disabled" currency="USD" value={1250.5} isDisabled />
  </div>
);

/**
 * Parsing and formatting both follow the locale, so a comma-decimal locale
 * reads `1,50` as one and a half rather than one hundred and fifty.
 */
export const Locales = () => (
  <div className="flex w-96 flex-col gap-8">
    {(
      [
        ['en-US', 'USD'],
        ['es-ES', 'EUR'],
        ['fr-FR', 'EUR'],
        ['pt-BR', 'BRL'],
        ['ar-EG', 'EGP'],
      ] as const
    ).map(([locale, currency]) => (
      <I18nProvider key={locale} locale={locale}>
        <CurrencyField
          label={`${locale} — ${currency}`}
          currency={currency}
          value={1234.5}
        />
      </I18nProvider>
    ))}
  </div>
);

export const Controlled = () => {
  const [amount, setAmount] = useState<number | null>(null);

  return (
    <div className="flex w-96 flex-col gap-4">
      <CurrencyField
        label="Construction / Materials / Labor"
        currency="USD"
        value={amount}
        onChange={(next) => setAmount(Number.isNaN(next) ? null : next)}
        inputProps={{ placeholder: '$0.00' }}
      />
      <pre className="text-sm">{JSON.stringify({ amount })}</pre>
    </div>
  );
};
