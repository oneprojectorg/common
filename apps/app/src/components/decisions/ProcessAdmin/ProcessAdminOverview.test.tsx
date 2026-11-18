// @vitest-environment jsdom
import { ProcessStatus } from '@op/api/encoders';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import en from '../../../lib/i18n/dictionaries/en.json';
import { ProcessAdminOverview } from './ProcessAdminOverview';

const { query, updateInstance } = await vi.hoisted(async () => {
  const { useState } = await import('react');
  const query: { decisionProfile: unknown; resources: unknown[] } = {
    decisionProfile: null,
    resources: [],
  };

  interface Callbacks {
    onSuccess?: () => unknown;
    onError?: (error: Error) => unknown;
    onSettled?: () => unknown;
  }

  /** A mutation mock whose latest save stays pending, per hook instance, until the test settles it with `succeed` or `fail`. */
  const pendingMutation = () => {
    const mutate = vi.fn();
    let settleLatest = async (_error?: Error) => {};

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
          settleLatest = async (error) => {
            if (error) {
              await hook.onError?.(error);
              await call.onError?.(error);
            } else {
              await hook.onSuccess?.();
              await call.onSuccess?.();
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
      succeed: () => settleLatest(),
      fail: () => settleLatest(new Error('save failed')),
    };
  };

  return { query, updateInstance: pendingMutation() };
});

vi.mock('@op/api/client', () => ({
  trpc: {
    useUtils: () => ({
      decision: { getDecisionBySlug: { invalidate: async () => {} } },
    }),
    decision: {
      getDecisionBySlug: {
        useSuspenseQuery: () => [query.decisionProfile],
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
vi.mock('@op/logging/client', () => ({ logger: { error: () => {} } }));
vi.mock('@op/sense/Toast', () => ({
  toast: { success: () => {}, error: () => {} },
}));

const SLUG = 'community-fund';

const seed = ({
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
}) => {
  query.decisionProfile = {
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
  };
};

const overview = (isOpen = false, aboutSlot: ReactNode = null) => (
  <NextIntlClientProvider locale="en" messages={en}>
    <ProcessAdminOverview slug={SLUG} isOpen={isOpen} aboutSlot={aboutSlot} />
  </NextIntlClientProvider>
);

const renderOverview = (isOpen = false, aboutSlot: ReactNode = null) =>
  render(overview(isOpen, aboutSlot));

const settleSave = (outcome: 'succeed' | 'fail') =>
  act(() => updateInstance[outcome]());

const phase = {
  phaseId: 'submit',
  name: 'Submit',
  startDate: '2026-01-01T00:00:00.000Z',
};

afterEach(() => {
  cleanup();
  query.resources = [];
  updateInstance.mutate.mockClear();
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

  it('renders the server-rendered About body over the plain description', () => {
    seed({ description: 'Plain description' });
    renderOverview(false, <p>Rich body</p>);

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
    renderOverview(true);

    expect(screen.getByTestId('phase-timeline').dataset.started).toBe('true');
    expect(screen.queryByText('No phases yet')).toBeNull();
  });

  it('links to the proposals once the process is open', () => {
    seed({ phases: [phase] });
    renderOverview(true);

    expect(
      screen
        .getByRole('link', { name: 'Browse proposals' })
        .getAttribute('href'),
    ).toContain(`/decisions/${SLUG}/current`);
  });

  it('keeps the timeline and the proposals link closed until the process is open', () => {
    seed({ phases: [phase] });
    renderOverview(false);

    expect(screen.queryByRole('link', { name: 'Browse proposals' })).toBeNull();
    expect(screen.getByTestId('phase-timeline').dataset.started).toBe('false');
  });

  it('shows the steward with the name isolated', () => {
    seed({ steward: { name: 'Amal Haddad', slug: 'amal' } });
    renderOverview();

    const name = screen.getByText('Amal Haddad', { selector: 'bdi' });
    expect(name.closest('span')?.textContent).toBe('Stewarded by Amal Haddad');
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

  it('saves a renamed draft title on Enter and refuses one below the minimum', async () => {
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

    await user.click(
      screen.getByRole('button', { name: 'Edit Neighbourhood Fund' }),
    );
    await user.keyboard('ab{Enter}');

    expect(updateInstance.mutate).toHaveBeenCalledTimes(1);
  });

  it('shows the renamed draft title while it saves and keeps it once the server has it', async () => {
    seed({ status: ProcessStatus.DRAFT });
    const { rerender } = renderOverview();
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

    seed({ status: ProcessStatus.DRAFT, name: 'Second Fund' });
    await settleSave('succeed');
    rerender(overview());

    expect(
      screen.getByRole('heading', { name: 'Second Fund', level: 1 }),
    ).toBeTruthy();
  });

  it('puts the draft title back to the saved name when the rename fails', async () => {
    seed({ status: ProcessStatus.DRAFT });
    renderOverview();
    const user = userEvent.setup();

    await user.click(
      screen.getByRole('button', { name: 'Edit Community Fund' }),
    );
    await user.keyboard('Neighbourhood Fund{Enter}');
    await settleSave('fail');

    expect(
      screen.getByRole('heading', { name: 'Community Fund', level: 1 }),
    ).toBeTruthy();
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
