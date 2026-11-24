// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import en from '../../../lib/i18n/dictionaries/en.json';
import { ProcessAdminPhasePage } from './ProcessAdminPhasePage';

const query = vi.hoisted(() => ({ phases: [] as object[] }));

vi.mock('@op/api/client', () => ({
  trpc: {
    decision: {
      getDecisionBySlug: {
        useSuspenseQuery: () => [{ processInstance: { phases: query.phases } }],
      },
    },
  },
}));

// The i18n Link prefetches through the app router, which a unit test has none of.
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useRouter: () => ({ prefetch: () => {}, push: () => {}, refresh: () => {} }),
  usePathname: () => '/',
}));
vi.mock('@/hooks/useForesight', () => ({
  useForesight: () => ({ elementRef: { current: null } }),
}));

const SLUG = 'community-fund';

const review = {
  id: 'row-review',
  slug: 'a1b2c3d4',
  phaseId: 'review',
  name: 'Review',
  startDate: '2026-03-01T12:00:00.000Z',
  endDate: '2026-03-20T12:00:00.000Z',
};

const renderPage = (phaseSlug: string) =>
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <ProcessAdminPhasePage slug={SLUG} phaseSlug={phaseSlug} />
    </NextIntlClientProvider>,
  );

afterEach(cleanup);

describe('ProcessAdminPhasePage', () => {
  it('shows the phase named in the URL with its dates', () => {
    query.phases = [{ ...review, slug: 'other', name: 'Submit' }, review];
    renderPage('a1b2c3d4');

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Review',
    );
    expect(screen.getByText(/^Mar \d+ - Mar \d+$/)).toBeTruthy();
  });

  it('links back to the process admin page', () => {
    query.phases = [review];
    renderPage('a1b2c3d4');

    expect(
      screen.getByRole('link', { name: 'Back' }).getAttribute('href'),
    ).toBe(`/en/decisions/${SLUG}/manage`);
  });

  it('says the phase no longer exists when a refetch has removed it', () => {
    query.phases = [];
    renderPage('a1b2c3d4');

    expect(screen.getByText('This phase no longer exists')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back' })).toBeTruthy();
  });
});
