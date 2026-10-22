// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import messages from '../../lib/i18n/dictionaries/en.json';
import { ResultsStats } from './ResultsStats';

const useSuspenseQuery = vi.fn();

vi.mock('@op/api/client', () => ({
  trpc: {
    decision: { getResultsStats: { useSuspenseQuery: () => useSuspenseQuery() } },
  },
}));

const renderStats = (totalAllocated: number) => {
  useSuspenseQuery.mockReturnValue([
    { membersVoted: 3, proposalsFunded: 2, totalAllocated },
  ]);
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ResultsStats instanceId="instance" />
    </NextIntlClientProvider>,
  );
};

describe('ResultsStats', () => {
  afterEach(cleanup);

  it('shows the total allocated when money was allocated', () => {
    renderStats(1000);
    expect(screen.getByText('Total Allocated')).toBeTruthy();
  });

  it('hides the total allocated when nothing was allocated', () => {
    renderStats(0);
    expect(screen.queryByText('Total Allocated')).toBeNull();
    expect(screen.getByText('Proposals Selected')).toBeTruthy();
  });
});
