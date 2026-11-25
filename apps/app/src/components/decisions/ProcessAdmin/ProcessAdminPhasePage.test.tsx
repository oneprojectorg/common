// @vitest-environment jsdom
import type { DecisionPhase } from '@op/api/encoders';
import { APP_NAME } from '@op/core';
import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import en from '../../../lib/i18n/dictionaries/en.json';
import { ProcessAdminPhasePage } from './ProcessAdminPhasePage';

const query: { phases: DecisionPhase[]; error: Error | null } = vi.hoisted(
  () => ({ phases: [], error: null }),
);

vi.mock('@op/api/client', () => ({
  trpc: {
    decision: {
      getDecisionBySlug: {
        useSuspenseQuery: () => {
          if (query.error) {
            throw query.error;
          }
          return [
            {
              name: 'Community Fund',
              processInstance: { phases: query.phases },
            },
          ];
        },
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

const page = (phaseSlug: string) => (
  <NextIntlClientProvider locale="en" messages={en}>
    <ProcessAdminPhasePage slug={SLUG} phaseSlug={phaseSlug} />
  </NextIntlClientProvider>
);

const renderPage = (phaseSlug: string) => render(page(phaseSlug));

afterEach(() => {
  cleanup();
  query.error = null;
  vi.restoreAllMocks();
});

describe('ProcessAdminPhasePage', () => {
  it('shows the phase named in the URL with its dates', () => {
    query.phases = [{ ...review, slug: 'other', name: 'Submit' }, review];
    renderPage('a1b2c3d4');

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Review',
    );
    expect(screen.getByText(/^Mar \d+ - Mar \d+$/)).toBeTruthy();
  });

  it('leaves the dates out when the phase has none', () => {
    query.phases = [{ ...review, startDate: undefined, endDate: undefined }];
    renderPage('a1b2c3d4');

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Review',
    );
    expect(screen.queryByText(/Mar/)).toBeNull();
  });

  it('links back to the process admin page', () => {
    query.phases = [review];
    renderPage('a1b2c3d4');

    expect(
      screen.getByRole('link', { name: 'Back' }).getAttribute('href'),
    ).toBe(`/en/decisions/${SLUG}/manage`);
  });

  it('names the tab after the phase and the decision, kept current on refetch', () => {
    query.phases = [review];
    const { rerender } = renderPage('a1b2c3d4');

    expect(document.title).toBe(`⁨Review⁩ · ⁨Community Fund⁩ | ${APP_NAME}`);

    query.phases = [{ ...review, name: 'Shortlist' }];
    rerender(page('a1b2c3d4'));

    expect(document.title).toBe(`⁨Shortlist⁩ · ⁨Community Fund⁩ | ${APP_NAME}`);
  });

  it('says the phase no longer exists when a refetch has removed it', () => {
    query.phases = [review];
    const { rerender } = renderPage('a1b2c3d4');

    expect(screen.getByRole('status').textContent).toBe('');

    query.phases = [{ ...review, slug: 'other', name: 'Submit' }];
    rerender(page('a1b2c3d4'));

    expect(screen.getByRole('status').textContent).toBe(
      'This phase no longer exists',
    );
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    expect(screen.queryByText('Submit')).toBeNull();
    expect(screen.getByRole('link', { name: 'Back' })).toBeTruthy();
  });

  it('says the phase failed to load and keeps the way back', () => {
    query.error = new Error('load failed');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderPage('a1b2c3d4');

    expect(screen.getByText("Couldn't load this phase")).toBeTruthy();
    expect(screen.queryByText("Couldn't load the overview")).toBeNull();
    expect(screen.getByRole('link', { name: 'Back' })).toBeTruthy();
  });
});
