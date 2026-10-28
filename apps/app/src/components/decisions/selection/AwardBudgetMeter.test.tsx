// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it } from 'vitest';

import messages from '../../../lib/i18n/dictionaries/en.json';
import { type AwardProposal, useProposalAwards } from '../useProposalAwards';
import { AwardBudgetMeter } from './AwardBudgetMeter';

const proposal = (
  id: string,
  budget: { amount: number; currency: string },
): AwardProposal => ({
  id,
  proposalData: { title: id, category: [], attachmentIds: [], budget },
});

const solar = proposal('solar', { amount: 12000, currency: 'USD' });
const bike = proposal('bike', { amount: 8200, currency: 'USD' });
const euro = proposal('euro', { amount: 4000, currency: 'EUR' });

const Harness = ({
  proposals,
  selectedIds,
  processBudget,
  edits = {},
}: {
  proposals: AwardProposal[];
  selectedIds: string[];
  processBudget: number;
  edits?: Record<string, number | null>;
}) => {
  const awards = useProposalAwards({
    proposals,
    selectedIds,
    isEnabled: true,
    processBudget,
    draft: [edits, () => {}],
  });

  return (
    <AwardBudgetMeter
      awards={awards}
      selectedIds={selectedIds}
      processBudget={processBudget}
    />
  );
};

const renderMeter = (props: Parameters<typeof Harness>[0]) =>
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <Harness {...props} />
    </NextIntlClientProvider>,
  );

afterEach(cleanup);

describe('AwardBudgetMeter', () => {
  it('sums the advanced awards against the process budget', () => {
    renderMeter({
      proposals: [solar, bike],
      selectedIds: ['solar', 'bike'],
      processBudget: 25000,
    });

    const bar = screen.getByRole('progressbar', { name: 'Budget allocated' });
    expect(bar.getAttribute('aria-valuenow')).toBe('20200');
    expect(bar.getAttribute('aria-valuemax')).toBe('25000');
    expect(bar.getAttribute('aria-valuetext')).toBe(
      '$20,200 of $25,000 allocated',
    );
    expect(screen.getByText('$20,200')).toBeTruthy();
    expect(screen.queryByText(/^Over budget/)).toBeNull();
  });

  it('warns by how much the awards pass the budget', () => {
    renderMeter({
      proposals: [solar, bike],
      selectedIds: ['solar', 'bike'],
      processBudget: 25000,
      edits: { solar: 17500 },
    });

    expect(screen.getByText('Over budget by $700')).toBeTruthy();
    expect(screen.getByText('$25,700').className).toContain('text-destructive');
  });

  it('counts only the advanced rows', () => {
    renderMeter({
      proposals: [solar, bike],
      selectedIds: ['bike'],
      processBudget: 25000,
    });

    expect(screen.getByRole('progressbar').getAttribute('aria-valuetext')).toBe(
      '$8,200 of $25,000 allocated',
    );
  });

  it('warns instead of measuring when the winners asked in different currencies', () => {
    renderMeter({
      proposals: [solar, euro],
      selectedIds: ['solar', 'euro'],
      processBudget: 25000,
    });

    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(
      screen.getByText(
        'The awards use more than one currency, so the total cannot be checked against the budget',
      ),
    ).toBeTruthy();
  });
});
