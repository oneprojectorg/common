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

const renderStats = (daysLeft: number | null, hasImage?: boolean) => {
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
      <VotingProgressStats processInstanceId="instance" hasImage={hasImage} />
    </NextIntlClientProvider>,
  );
};

describe('VotingProgressStats', () => {
  afterEach(cleanup);

  it('shows who voted, the turnout and the days left in the phase', () => {
    renderStats(9);
    expect(screen.getByText('412/581')).toBeTruthy();
    expect(screen.getByText('71%')).toBeTruthy();
    expect(screen.getByText('9')).toBeTruthy();
    expect(screen.getByText('Days left')).toBeTruthy();
  });

  it('hides the days left when the phase has no end date', () => {
    renderStats(null);
    expect(screen.getByText('Turnout')).toBeTruthy();
    expect(screen.queryByText('Days left')).toBeNull();
  });

  it('uses white text over a banner image and the foreground colour otherwise', () => {
    renderStats(9, true);
    expect(screen.getByText('Turnout').closest('.text-white')).toBeTruthy();
    cleanup();

    renderStats(9, false);
    expect(screen.getByText('Turnout').closest('.text-white')).toBeNull();
    expect(
      screen.getByText('Turnout').closest('.text-foreground'),
    ).toBeTruthy();
  });

  it('shows the default error when the stats cannot load', () => {
    // React logs the caught error; keep the test output clean.
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    useSuspenseQuery.mockImplementation(() => {
      throw new Error('Forbidden');
    });
    const { container } = render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <VotingProgressStats processInstanceId="instance" />
      </NextIntlClientProvider>,
    );
    expect(container.textContent).toBe('Something went wrong');
    useSuspenseQuery.mockReset();
    consoleError.mockRestore();
  });
});
