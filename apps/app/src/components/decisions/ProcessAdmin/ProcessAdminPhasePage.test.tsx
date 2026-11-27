// @vitest-environment jsdom
import type { DecisionPhase } from '@op/api/encoders';
import { APP_NAME } from '@op/core';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import en from '../../../lib/i18n/dictionaries/en.json';
import { ProcessAdminPhasePage } from './ProcessAdminPhasePage';

interface SaveHook {
  onError?: (error: Error) => void;
}

interface Save {
  input: unknown;
  onSuccess?: () => void;
}

const { query, toast, logger } = vi.hoisted(() => {
  const query: {
    phases: DecisionPhase[];
    status: string;
    currentStateId: string | null;
    error: Error | null;
    saveHook: SaveHook;
    saves: Save[];
  } = {
    phases: [],
    status: 'draft',
    currentStateId: null,
    error: null,
    saveHook: {},
    saves: [],
  };

  return {
    query,
    toast: { success: vi.fn(), error: vi.fn() },
    logger: { error: vi.fn() },
  };
});

vi.mock('@op/api/client', () => ({
  trpc: {
    useUtils: () => ({}),
    decision: {
      getDecisionBySlug: {
        useSuspenseQuery: () => {
          if (query.error) {
            throw query.error;
          }
          return [
            {
              name: 'Community Fund',
              processInstance: {
                phases: query.phases,
                status: query.status,
                currentStateId: query.currentStateId,
              },
            },
          ];
        },
      },
      updatePhase: {
        useMutation: (hook: SaveHook) => {
          query.saveHook = hook;
          return {
            isPending: false,
            mutate: (input: unknown, call?: { onSuccess?: () => void }) => {
              query.saves.push({ input, onSuccess: call?.onSuccess });
            },
          };
        },
      },
    },
  },
}));
vi.mock('@op/sense/Toast', () => ({ toast }));
vi.mock('@op/logging/client', () => ({ logger }));

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
  rules: { reviews: { submit: true } },
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
  query.phases = [];
  query.status = 'draft';
  query.currentStateId = null;
  query.error = null;
  query.saves = [];
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

const rename = (from: string, to: string) => {
  fireEvent.click(screen.getByRole('button', { name: `Edit ${from}` }));
  const field = screen.getByRole('textbox', { name: 'Phase name' });
  fireEvent.change(field, { target: { value: to } });
  fireEvent.keyDown(field, { key: 'Enter' });
};

const heading = () => screen.getByRole('heading', { level: 1 }).textContent;

const vote = {
  ...review,
  id: 'row-vote',
  slug: 'e5f6a7b8',
  phaseId: 'vote',
  name: 'Vote',
  rules: { voting: { submit: true } },
};

describe('ProcessAdminPhasePage', () => {
  it('shows the phase named in the URL with its kind and dates', () => {
    query.phases = [
      {
        ...review,
        slug: 'other',
        name: 'Submit',
        rules: { proposals: { submit: true } },
        endDate: '2026-02-27T12:00:00.000Z',
      },
      review,
    ];
    renderPage('a1b2c3d4');

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Review',
    );
    expect(screen.getByText('Review phase')).toBeTruthy();
    expect(screen.getByText('Review period')).toBeTruthy();
    expect(screen.getByText(/^Mar \d+ - Mar \d+$/)).toBeTruthy();
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === 'SPAN' &&
          element.textContent === 'End of “Submit”: Feb 27.',
      ),
    ).toBeTruthy();
  });

  it('leaves the dates out when the phase has none', () => {
    query.phases = [{ ...review, startDate: undefined, endDate: undefined }];
    renderPage('a1b2c3d4');

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Review',
    );
    expect(screen.getByText('No dates yet')).toBeTruthy();
    expect(screen.queryByText(/Mar/)).toBeNull();
  });

  it('gives a results phase its own labels and a one-day date', () => {
    const results = {
      ...review,
      id: 'row-results',
      slug: 'f0e1d2c3',
      phaseId: 'results',
      name: 'Results',
      rules: {},
      startDate: '2026-04-02T12:00:00.000Z',
      endDate: undefined,
    };
    query.phases = [{ ...review, endDate: undefined }, results];
    renderPage('f0e1d2c3');

    expect(screen.getByText('Results phase')).toBeTruthy();
    expect(screen.getByText('When results are shared')).toBeTruthy();
    expect(screen.getByText(/^Apr \d+$/)).toBeTruthy();
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === 'SPAN' &&
          element.textContent === '“Review” has no end date yet.',
      ),
    ).toBeTruthy();
  });

  it('says nothing about an earlier phase on the first one', () => {
    query.phases = [review, vote];
    renderPage('a1b2c3d4');

    expect(screen.getByText('Review period')).toBeTruthy();
    expect(screen.queryByText(/^End of/)).toBeNull();
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

    expect(document.title).toBe(
      `\u2068Review\u2069 · \u2068Community Fund\u2069 | ${APP_NAME}`,
    );

    query.phases = [{ ...review, name: 'Shortlist' }];
    rerender(page('a1b2c3d4'));

    expect(document.title).toBe(
      `\u2068Shortlist\u2069 · \u2068Community Fund\u2069 | ${APP_NAME}`,
    );
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

  it('saves a renamed phase from the header, then settles', () => {
    query.phases = [review];
    const { rerender } = renderPage('a1b2c3d4');

    const save = screen.getByRole('button', { name: 'Save' });
    expect(save.hasAttribute('disabled')).toBe(true);

    rename('Review', 'Shortlisting');
    expect(heading()).toBe('Shortlisting');
    expect(save.hasAttribute('disabled')).toBe(false);

    fireEvent.click(save);
    expect(query.saves.map((call) => call.input)).toEqual([
      { phaseId: 'row-review', name: 'Shortlisting' },
    ]);

    query.phases = [{ ...review, name: 'Shortlisting' }];
    rerender(page('a1b2c3d4'));
    act(() => query.saves[0]?.onSuccess?.());

    expect(heading()).toBe('Shortlisting');
    expect(save.hasAttribute('disabled')).toBe(true);
  });

  it('keeps a rename made while an earlier save was in flight', () => {
    query.phases = [review];
    const { rerender } = renderPage('a1b2c3d4');

    rename('Review', 'Shortlisting');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    rename('Shortlisting', 'Final shortlist');

    query.phases = [{ ...review, name: 'Shortlisting' }];
    rerender(page('a1b2c3d4'));
    act(() => query.saves[0]?.onSuccess?.());

    expect(heading()).toBe('Final shortlist');
    expect(
      screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled'),
    ).toBe(false);
  });

  it('keeps the rename and says so when the save fails', () => {
    query.phases = [review];
    renderPage('a1b2c3d4');

    rename('Review', 'Shortlisting');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    act(() => query.saveHook.onError?.(new Error('save failed')));

    expect(toast.error).toHaveBeenCalledWith('Your change was not saved.');
    expect(logger.error).toHaveBeenCalled();
    expect(heading()).toBe('Shortlisting');
    expect(
      screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled'),
    ).toBe(false);
  });

  it('drops a rename that is undone, so a later rename elsewhere shows', () => {
    query.phases = [review];
    const { rerender } = renderPage('a1b2c3d4');

    rename('Review', 'Shortlisting');
    rename('Shortlisting', 'Review');
    expect(
      screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled'),
    ).toBe(true);

    query.phases = [{ ...review, name: 'Panel review' }];
    rerender(page('a1b2c3d4'));

    expect(heading()).toBe('Panel review');
    expect(
      screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled'),
    ).toBe(true);
  });

  it('shows the saved name once an unsaved rename gets locked', () => {
    query.status = 'published';
    query.currentStateId = 'review';
    query.phases = [review, vote];
    const { rerender } = renderPage('a1b2c3d4');

    rename('Review', 'Shortlisting');
    expect(heading()).toBe('Shortlisting');

    query.currentStateId = 'vote';
    rerender(page('a1b2c3d4'));

    expect(heading()).toBe('Review');
    expect(
      screen.getByRole('button', { name: 'Update' }).hasAttribute('disabled'),
    ).toBe(true);
  });

  it('locks the name of a phase the live process has left', () => {
    query.status = 'published';
    query.currentStateId = 'vote';
    query.phases = [review, vote];
    renderPage('a1b2c3d4');

    expect(heading()).toBe('Review');
    expect(screen.queryByRole('button', { name: 'Edit Review' })).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Update' }).hasAttribute('disabled'),
    ).toBe(true);
  });

  it('locks every phase when the live current phase matches none', () => {
    query.status = 'published';
    query.currentStateId = 'gone';
    query.phases = [review, vote];
    renderPage('e5f6a7b8');

    expect(screen.queryByRole('button', { name: 'Edit Vote' })).toBeNull();
  });

  it.each([
    ['the current phase of a live process', 'published', 'review', 'a1b2c3d4'],
    ['a later phase of a live process', 'published', 'review', 'e5f6a7b8'],
    ['a live process with no current phase', 'published', null, 'a1b2c3d4'],
    ['an earlier phase of a draft', 'draft', 'vote', 'a1b2c3d4'],
  ])('keeps %s editable', (_, status, currentStateId, phaseSlug) => {
    query.status = status;
    query.currentStateId = currentStateId;
    query.phases = [review, vote];
    renderPage(phaseSlug);

    expect(
      screen.getByRole('button', { name: /^Edit (Review|Vote)$/ }),
    ).toBeTruthy();
  });

  it('saves through Update on a live process', () => {
    query.status = 'published';
    query.currentStateId = 'review';
    query.phases = [review, vote];
    renderPage('a1b2c3d4');

    rename('Review', 'Shortlisting');
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));

    expect(query.saves.map((call) => call.input)).toEqual([
      { phaseId: 'row-review', name: 'Shortlisting' },
    ]);
  });

  it('cannot rename a phase that has no row yet', () => {
    query.phases = [{ ...review, id: null }];
    renderPage('a1b2c3d4');

    expect(heading()).toBe('Review');
    expect(screen.queryByRole('button', { name: 'Edit Review' })).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Save' }).hasAttribute('disabled'),
    ).toBe(true);
  });
});
