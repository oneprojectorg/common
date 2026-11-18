// @vitest-environment jsdom
import { ProcessStatus } from '@op/api/encoders';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import en from '../../../lib/i18n/dictionaries/en.json';
import { ProcessAdminOverview } from './ProcessAdminOverview';

const { query, updateInstance, utils, toast, logger } = await vi.hoisted(
  async () => {
    const { useState } = await import('react');
    const query: {
      decisionProfile: unknown;
      resources: unknown[];
      error: Error | null;
    } = {
      decisionProfile: null,
      resources: [],
      error: null,
    };

    const utils = {
      // Applies the updater, as the query cache would, so a test can read what the page shows before any refetch.
      setData: vi.fn(
        (_input: unknown, update: (current: unknown) => unknown) => {
          query.decisionProfile = update(query.decisionProfile);
        },
      ),
      invalidate: vi.fn(
        async (_input: unknown, _filters?: unknown, _options?: unknown) => {},
      ),
    };
    const toast = { success: vi.fn(), error: vi.fn() };
    const logger = { error: vi.fn() };

    interface Callbacks {
      onSuccess?: (saved: unknown) => unknown;
      onError?: (error: Error) => unknown;
      onSettled?: () => unknown;
    }

    /** A mutation mock whose latest save stays pending, per hook instance, until the test settles it with `succeed` or `fail`. */
    const pendingMutation = () => {
      const mutate = vi.fn();
      let settleLatest = async (_outcome: {
        error?: Error;
        saved?: unknown;
      }) => {};

      const useMutation = (hook: Callbacks = {}) => {
        const [variables, setVariables] = useState<unknown>(undefined);
        const [isPending, setIsPending] = useState(false);

        return {
          isPending,
          variables,
          mutate: (input: unknown, call: Callbacks = {}) => {
            mutate(input, call);
            setVariables(input);
            setIsPending(true);
            settleLatest = async ({ error, saved }) => {
              if (error) {
                await hook.onError?.(error);
                await call.onError?.(error);
              } else {
                await hook.onSuccess?.(saved);
                await call.onSuccess?.(saved);
              }
              await call.onSettled?.();
              setIsPending(false);
            };
          },
        };
      };

      return {
        mutate,
        useMutation,
        succeed: (saved: unknown) => settleLatest({ saved }),
        fail: () => settleLatest({ error: new Error('save failed') }),
      };
    };

    return { query, updateInstance: pendingMutation(), utils, toast, logger };
  },
);

vi.mock('@op/api/client', () => ({
  trpc: {
    useUtils: () => ({ decision: { getDecisionBySlug: utils } }),
    decision: {
      getDecisionBySlug: {
        useSuspenseQuery: () => {
          if (query.error) {
            throw query.error;
          }
          return [query.decisionProfile];
        },
      },
      updateDecisionInstance: { useMutation: updateInstance.useMutation },
    },
    resources: {
      list: {
        useSuspenseQuery: () => [{ items: query.resources }],
      },
    },
  },
}));

// The timeline owns the phase-advance mutation; this test only needs to know
// whether it rendered and what it was told.
vi.mock('../DecisionPhaseTimeline', () => ({
  DecisionPhaseTimeline: ({ hasStarted }: { hasStarted: boolean }) => (
    <div data-testid="phase-timeline" data-started={String(hasStarted)} />
  ),
}));

// The i18n Link prefetches through the app router and an IntersectionObserver,
// neither of which a unit test has.
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useRouter: () => ({ prefetch: () => {}, push: () => {} }),
  usePathname: () => '/',
}));
vi.mock('@/hooks/useForesight', () => ({
  useForesight: () => ({ elementRef: { current: null } }),
}));

vi.mock('@/hooks/useCanLinkToProfile', () => ({
  useCanLinkToProfile: () => false,
}));
vi.mock('@op/logging/client', () => ({ logger }));
vi.mock('@op/sense/Toast', () => ({ toast }));

vi.mock('@/components/Resources/PinnedResourceCard', () => ({
  PinnedResourceCard: ({ resource }: { resource: { title: string } }) => (
    <div data-testid="pinned-resource">{resource.title}</div>
  ),
}));

// The upload modal owns its own mutations; this test only needs its change signal.
vi.mock('../BannerUploadModal', () => ({
  BannerUploadModal: ({
    isOpen,
    onChange,
  }: {
    isOpen: boolean;
    onChange?: () => void;
  }) =>
    isOpen ? (
      <button type="button" onClick={onChange}>
        Save banner
      </button>
    ) : null,
}));

const SLUG = 'community-fund';

const profile = ({
  status = ProcessStatus.PUBLISHED,
  description = null,
  phases = [],
  steward = null,
  heroImage,
  isPrivate = false,
  name = 'Community Fund',
}: {
  name?: string;
  status?: string;
  description?: string | null;
  phases?: object[];
  steward?: object | null;
  heroImage?: string;
  isPrivate?: boolean;
}) => ({
  name,
  processInstance: {
    id: 'instance-1',
    profileId: 'profile-1',
    status,
    description,
    currentStateId: null,
    steward,
    instanceData: {
      phases,
      config: { isPrivate },
      overview: heroImage ? { heroImage } : undefined,
    },
  },
});

const seed = (options: Parameters<typeof profile>[0]) => {
  query.decisionProfile = profile(options);
};

const AFTER_START = Date.parse('2026-06-01T00:00:00.000Z');
const BEFORE_START = Date.parse('2025-12-01T00:00:00.000Z');

const overview = (renderedAt = AFTER_START, aboutSlot: ReactNode = null) => (
  <NextIntlClientProvider locale="en" messages={en}>
    <ProcessAdminOverview
      slug={SLUG}
      renderedAt={renderedAt}
      aboutSlot={aboutSlot}
    />
  </NextIntlClientProvider>
);

const renderOverview = (
  renderedAt = AFTER_START,
  aboutSlot: ReactNode = null,
) => render(overview(renderedAt, aboutSlot));

const succeedSave = (saved: unknown) =>
  act(() => updateInstance.succeed(saved));
const failSave = () => act(() => updateInstance.fail());

const phase = {
  phaseId: 'submit',
  name: 'Submit',
  startDate: '2026-01-01T00:00:00.000Z',
};

afterEach(() => {
  cleanup();
  query.resources = [];
  query.error = null;
  vi.clearAllMocks();
});

describe('ProcessAdminOverview', () => {
  it('shows the three empty states for an empty process', () => {
    seed({});
    renderOverview();

    expect(screen.getByText('No phases yet')).toBeTruthy();
    expect(screen.getByText('No pinned resources')).toBeTruthy();
    expect(screen.getByText('No description yet')).toBeTruthy();
    expect(screen.queryByTestId('phase-timeline')).toBeNull();
  });

  it('lists the pinned resources in place of their empty state', () => {
    seed({});
    query.resources = [
      { id: 'resource-1', collectionId: 'collection-1', title: 'Budget guide' },
    ];
    renderOverview();

    expect(screen.getByTestId('pinned-resource').textContent).toBe(
      'Budget guide',
    );
    expect(
      screen.getByRole('heading', { name: 'Pinned Resources' }),
    ).toBeTruthy();
    expect(screen.queryByText('No pinned resources')).toBeNull();
  });

  it('keeps the way back, and no status or actions, when the process fails to load', () => {
    query.error = new Error('load failed');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderOverview();

    expect(screen.getByText("Couldn't load the overview")).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to editor' })).toBeTruthy();
    expect(screen.queryByText('Live')).toBeNull();
    expect(screen.queryByRole('link', { name: 'View process' })).toBeNull();
  });

  it('renders the server-rendered About body over the plain description', () => {
    seed({ description: 'Plain description' });
    renderOverview(AFTER_START, <p>Rich body</p>);

    expect(screen.getByText('Rich body')).toBeTruthy();
    expect(screen.queryByText('Plain description')).toBeNull();
  });

  it('falls back to the decoded plain description when there is no body', () => {
    seed({ description: 'Funds &amp; grants for the neighbourhood' });
    renderOverview();

    expect(
      screen.getByText('Funds & grants for the neighbourhood'),
    ).toBeTruthy();
    expect(screen.queryByText('No description yet')).toBeNull();
  });

  it('renders the phase timeline when the process has phases', () => {
    seed({ phases: [phase] });
    renderOverview();

    expect(screen.getByTestId('phase-timeline').dataset.started).toBe('true');
    expect(screen.queryByText('No phases yet')).toBeNull();
  });

  it('links to the proposals once the process is open', () => {
    seed({ phases: [phase] });
    renderOverview();

    expect(
      screen
        .getByRole('link', { name: 'Browse proposals' })
        .getAttribute('href'),
    ).toContain(`/decisions/${SLUG}/current`);
  });

  it('keeps the timeline and the proposals link closed until the process is open', () => {
    seed({ phases: [phase] });
    renderOverview(BEFORE_START);

    expect(screen.queryByRole('link', { name: 'Browse proposals' })).toBeNull();
    expect(screen.getByTestId('phase-timeline').dataset.started).toBe('false');
  });

  it('opens the timeline and the proposals link when a refetch publishes the draft', () => {
    seed({ status: ProcessStatus.DRAFT, phases: [phase] });
    const { rerender } = renderOverview();

    expect(screen.queryByRole('link', { name: 'Browse proposals' })).toBeNull();

    seed({ status: ProcessStatus.PUBLISHED, phases: [phase] });
    rerender(overview());

    expect(screen.getByRole('link', { name: 'Browse proposals' })).toBeTruthy();
    expect(screen.getByTestId('phase-timeline').dataset.started).toBe('true');
  });

  it('shows the steward with the name isolated', () => {
    seed({ steward: { name: 'Amal Haddad', slug: 'amal' } });
    renderOverview();

    const name = screen.getByText('Amal Haddad', { selector: 'bdi' });
    expect(name.closest('span')?.textContent).toBe('Stewarded by Amal Haddad');
  });

  it('keeps the steward after a draft rename saves', async () => {
    seed({
      status: ProcessStatus.DRAFT,
      steward: { name: 'Amal Haddad', slug: 'amal' },
    });
    renderOverview();
    const user = userEvent.setup();

    await user.click(
      screen.getByRole('button', { name: 'Edit Community Fund' }),
    );
    await user.keyboard('Neighbourhood Fund{Enter}');
    const { steward: _steward, ...savedInstance } = profile({
      status: ProcessStatus.DRAFT,
      name: 'Neighbourhood Fund',
    }).processInstance;
    await succeedSave({
      name: 'Neighbourhood Fund',
      processInstance: savedInstance,
    });

    expect(screen.getByText('Amal Haddad', { selector: 'bdi' })).toBeTruthy();
  });

  it.each([
    [ProcessStatus.DRAFT, 'Draft'],
    [ProcessStatus.PUBLISHED, 'Live'],
    [ProcessStatus.COMPLETED, 'Completed'],
    [ProcessStatus.CANCELLED, 'Cancelled'],
  ])('labels a %s process as %s', (status, label) => {
    seed({ status });
    renderOverview();

    expect(screen.getByText(label)).toBeTruthy();
  });

  it('links back to the editor', () => {
    seed({});
    renderOverview();

    expect(
      screen.getByRole('link', { name: 'Back to editor' }).getAttribute('href'),
    ).toContain(`/decisions/${SLUG}/edit`);
  });

  it('gives a draft an inert launch, not the public view', () => {
    seed({ status: ProcessStatus.DRAFT });
    renderOverview();

    expect(
      screen
        .getByRole('button', { name: 'Launch process' })
        .getAttribute('aria-disabled'),
    ).toBe('true');
    expect(screen.queryByRole('link', { name: 'View process' })).toBeNull();
  });

  it('gives a live process the public view, not a launch', () => {
    seed({});
    renderOverview();

    expect(
      screen.getByRole('link', { name: 'View process' }).getAttribute('href'),
    ).toContain(`/decisions/${SLUG}`);
    expect(screen.queryByRole('button', { name: 'Launch process' })).toBeNull();
  });

  it('edits a draft title in place and keeps a live title read-only', () => {
    seed({ status: ProcessStatus.DRAFT });
    const { unmount } = renderOverview();

    expect(
      screen.getByRole('heading', { name: 'Community Fund', level: 1 }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Edit Community Fund' }),
    ).toBeTruthy();
    unmount();

    seed({});
    renderOverview();

    expect(
      screen.getByRole('heading', { name: 'Community Fund', level: 1 }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Edit Community Fund' }),
    ).toBeNull();
  });

  it('saves a renamed draft title on Enter', async () => {
    seed({ status: ProcessStatus.DRAFT });
    renderOverview();
    const user = userEvent.setup();

    await user.click(
      screen.getByRole('button', { name: 'Edit Community Fund' }),
    );
    await user.keyboard('Neighbourhood Fund{Enter}');

    expect(updateInstance.mutate).toHaveBeenCalledTimes(1);
    expect(updateInstance.mutate.mock.calls[0]?.[0]).toEqual({
      instanceId: 'instance-1',
      name: 'Neighbourhood Fund',
    });
  });

  it('refuses a draft title below the minimum and says why', async () => {
    seed({ status: ProcessStatus.DRAFT });
    renderOverview();
    const user = userEvent.setup();

    await user.click(
      screen.getByRole('button', { name: 'Edit Community Fund' }),
    );
    await user.keyboard('ab{Enter}');

    expect(updateInstance.mutate).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      'The name needs at least 3 characters.',
    );

    await user.click(
      screen.getByRole('button', { name: 'Edit Community Fund' }),
    );
    await user.keyboard('abc{Enter}');

    expect(updateInstance.mutate.mock.calls[0]?.[0]).toEqual({
      instanceId: 'instance-1',
      name: 'abc',
    });
  });

  it('shows the latest renamed draft title while it saves', async () => {
    seed({ status: ProcessStatus.DRAFT });
    renderOverview();
    const user = userEvent.setup();

    await user.click(
      screen.getByRole('button', { name: 'Edit Community Fund' }),
    );
    await user.keyboard('First Fund{Enter}');
    await user.click(screen.getByRole('button', { name: 'Edit First Fund' }));
    await user.keyboard('Second Fund{Enter}');

    expect(
      screen.getByRole('heading', { name: 'Second Fund', level: 1 }),
    ).toBeTruthy();
  });

  it('keeps the saved draft title when the refetch brings nothing back', async () => {
    seed({ status: ProcessStatus.DRAFT });
    const { rerender } = renderOverview();
    const user = userEvent.setup();

    await user.click(
      screen.getByRole('button', { name: 'Edit Community Fund' }),
    );
    await user.keyboard('Neighbourhood Fund{Enter}');
    await succeedSave(
      profile({ status: ProcessStatus.DRAFT, name: 'Neighbourhood Fund' }),
    );
    rerender(overview());

    expect(
      screen.getByRole('heading', { name: 'Neighbourhood Fund', level: 1 }),
    ).toBeTruthy();
    expect(utils.invalidate).toHaveBeenCalledWith({ slug: SLUG }, undefined, {
      cancelRefetch: false,
    });
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('puts the draft title back and says so when the rename fails', async () => {
    seed({ status: ProcessStatus.DRAFT });
    renderOverview();
    const user = userEvent.setup();

    await user.click(
      screen.getByRole('button', { name: 'Edit Community Fund' }),
    );
    await user.keyboard('Neighbourhood Fund{Enter}');

    expect(
      screen.getByRole('heading', { name: 'Neighbourhood Fund', level: 1 }),
    ).toBeTruthy();

    await failSave();

    expect(
      screen.getByRole('heading', { name: 'Community Fund', level: 1 }),
    ).toBeTruthy();
    expect(toast.error).toHaveBeenCalledWith('Your change was not saved.');
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(utils.setData).not.toHaveBeenCalled();
  });

  it('refetches the process, without a reload, when the banner changes', async () => {
    seed({});
    renderOverview();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Add banner' }));
    await user.click(screen.getByRole('button', { name: 'Save banner' }));

    expect(utils.invalidate).toHaveBeenCalledWith({ slug: SLUG }, undefined, {
      cancelRefetch: false,
    });
  });

  it('names the banner control by whether there is a banner', () => {
    seed({});
    const { unmount } = renderOverview();

    expect(screen.getByRole('button', { name: 'Add banner' })).toBeTruthy();
    unmount();

    seed({ heroImage: 'instance-1/overview/hero.jpg' });
    renderOverview();

    expect(screen.getByRole('button', { name: 'Edit banner' })).toBeTruthy();
  });
});
