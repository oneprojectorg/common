// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import messages from '../../lib/i18n/dictionaries/en.json';
import { VotingProgressStats } from './VotingProgressStats';

const useSuspenseQuery = vi.fn();

vi.mock('@op/api/client', () => ({
  trpc: {
    decision: {
      getVotingProgress: { useSuspenseQuery: () => useSuspenseQuery() },
    },
  },
}));

const renderStats = (daysLeft: number | null) => {
  useSuspenseQuery.mockReturnValue([
    {
      participantsVotedCount: 412,
      participantsEligibleCount: 581,
      turnoutPercentage: 71,
      daysLeft,
    },
  ]);
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <VotingProgressStats processInstanceId="instance" />
    </NextIntlClientProvider>,
  );
};

describe('VotingProgressStats', () => {
  afterEach(cleanup);

  it('shows who voted, the turnout and the days left in the phase', () => {
    renderStats(12);
    expect(screen.getByText('412/581')).toBeTruthy();
    expect(screen.getByText('71%')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('Days left')).toBeTruthy();
  });

  it('hides the days left when the phase has no end date', () => {
    renderStats(null);
    expect(screen.getByText('Turnout')).toBeTruthy();
    expect(screen.queryByText('Days left')).toBeNull();
  });
});
