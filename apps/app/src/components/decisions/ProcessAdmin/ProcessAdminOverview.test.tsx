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

const refresh = vi.hoisted(() => vi.fn());

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

// The i18n Link prefetches through the app router and an IntersectionObserver,
// neither of which a unit test has.
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useRouter: () => ({ prefetch: () => {}, push: () => {}, refresh }),
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
  currentStateId = null,
  steward = null,
  heroImage,
  isPrivate = false,
  name = 'Community Fund',
  proposalTemplate,
}: {
  name?: string;
  proposalTemplate?: object;
  status?: string;
  description?: string | null;
  phases?: object[];
  currentStateId?: string | null;
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
    currentStateId,
    steward,
    phases,
    instanceData: {
      phases,
      config: { isPrivate },
      proposalTemplate,
      overview: heroImage ? { heroImage } : undefined,
    },
  },
});

const seed = (options: Parameters<typeof profile>[0]) => {
  query.decisionProfile = profile(options);
};

const overview = (isOpen = false, aboutSlot: ReactNode = null) => (
  <NextIntlClientProvider locale="en" messages={en}>
    <ProcessAdminOverview slug={SLUG} isOpen={isOpen} aboutSlot={aboutSlot} />
  </NextIntlClientProvider>
);

const renderOverview = (isOpen = false, aboutSlot: ReactNode = null) =>
  render(overview(isOpen, aboutSlot));

const succeedSave = (saved: unknown) =>
  act(() => updateInstance.succeed(saved));
const failSave = () => act(() => updateInstance.fail());

const phase = {
  id: 'row-submit',
  slug: 'a1b2c3d4',
  phaseId: 'submit',
  name: 'Submit',
  startDate: '2026-01-01T00:00:00.000Z',
  endDate: '2026-01-31T00:00:00.000Z',
};
const votePhase = {
  id: 'row-vote',
  slug: 'e5f6a7b8',
  phaseId: 'vote',
  name: 'Vote',
  startDate: '2026-02-01T00:00:00.000Z',
  endDate: '2026-02-28T00:00:00.000Z',
};
const developPhase = {
  id: 'row-develop',
  slug: 'c9d0e1f2',
  phaseId: 'develop',
  name: 'Develop',
  startDate: '2026-02-01T00:00:00.000Z',
  endDate: '2026-02-28T00:00:00.000Z',
  rules: { proposals: { develop: true } },
};
const editorHref = (phaseSlug: string) =>
  `/en/decisions/${SLUG}/manage/phase/${phaseSlug}`;

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
    seed({ phases: [phase, votePhase], currentStateId: 'vote' });
    renderOverview(true);

    expect(screen.getByText('Submit')).toBeTruthy();
    expect(
      screen.getByRole('link', { name: /Vote/ }).getAttribute('href'),
    ).toBe(`/decisions/${SLUG}/current`);
    expect(screen.queryByText('No phases yet')).toBeNull();
  });

  it('updates the rail when a refetch renames a phase or advances the current one', () => {
    seed({ phases: [phase, votePhase], currentStateId: 'submit' });
    const { rerender } = renderOverview(true);

    seed({
      phases: [{ ...phase, name: 'Ideas' }, votePhase],
      currentStateId: 'vote',
    });
    rerender(overview(true));

    expect(screen.getByText('Ideas')).toBeTruthy();
    expect(screen.queryByText('Submit')).toBeNull();
    expect(screen.getByRole('link', { name: /Vote/ })).toBeTruthy();
  });

  it('shows the phases of a draft as editable cards', () => {
    seed({ status: ProcessStatus.DRAFT, phases: [phase, votePhase] });
    renderOverview();

    expect(
      screen.getByRole('link', { name: /Submit/ }).getAttribute('href'),
    ).toBe(editorHref('a1b2c3d4'));
    expect(
      screen.getByRole('link', { name: /Vote/ }).getAttribute('href'),
    ).toBe(editorHref('e5f6a7b8'));
  });

  it('asks a live process to set up an upcoming phase that has no form yet', () => {
    seed({
      phases: [phase, developPhase],
      currentStateId: 'submit',
    });
    renderOverview(true);

    expect(
      screen.getByRole('link', { name: 'Set up Develop' }).getAttribute('href'),
    ).toBe(editorHref('c9d0e1f2'));
  });

  it('does not ask a live process to set up a phase that is ready', () => {
    seed({
      phases: [phase, developPhase],
      currentStateId: 'submit',
      proposalTemplate: { type: 'object', properties: { summary: {} } },
    });
    renderOverview(true);

    expect(screen.getByText('Develop')).toBeTruthy();
    expect(screen.queryByRole('link', { name: /^Set up/ })).toBeNull();
  });

  it('keeps the rail of a live process at rest', () => {
    seed({ phases: [phase, votePhase], currentStateId: 'vote' });
    renderOverview(true);

    expect(screen.queryByRole('link', { name: /Submit/ })).toBeNull();
  });

  it('switches a live process rail into editing and back', async () => {
    seed({ phases: [phase, votePhase], currentStateId: 'vote' });
    renderOverview(true);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Edit phases' }));
    expect(
      screen.getByRole('link', { name: /Submit/ }).getAttribute('href'),
    ).toBe(editorHref('a1b2c3d4'));

    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('link', { name: /Submit/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Edit phases' })).toBeTruthy();
  });

  it('gives a live process with no phases no Edit button', () => {
    seed({ phases: [] });
    renderOverview(true);

    expect(screen.queryByRole('button', { name: 'Edit phases' })).toBeNull();
  });

  it('gives a draft no Edit button, as its rail is always editing', () => {
    seed({ status: ProcessStatus.DRAFT, phases: [phase] });
    renderOverview();

    expect(screen.queryByRole('button', { name: 'Edit phases' })).toBeNull();
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
    expect(screen.getByText('Submit')).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Submit/ })).toBeNull();
  });

  it.each([
    [
      'publishes the draft',
      { status: ProcessStatus.PUBLISHED, phases: [phase] },
    ],
    [
      'moves the first start date',
      {
        status: ProcessStatus.DRAFT,
        phases: [{ ...phase, startDate: '2026-02-01T00:00:00.000Z' }],
      },
    ],
    ['removes the last phase', { status: ProcessStatus.DRAFT, phases: [] }],
  ])('refreshes the page when a refetch %s', (_change, refetched) => {
    seed({ status: ProcessStatus.DRAFT, phases: [phase] });
    const { rerender } = renderOverview();
    expect(refresh).not.toHaveBeenCalled();

    seed(refetched);
    rerender(overview());

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('does not refresh the page when a refetch leaves the status and dates alone', async () => {
    seed({ status: ProcessStatus.DRAFT, phases: [phase] });
    renderOverview();
    const user = userEvent.setup();

    await user.click(
      screen.getByRole('button', { name: 'Edit Community Fund' }),
    );
    await user.keyboard('Neighbourhood Fund{Enter}');
    await succeedSave(
      profile({
        status: ProcessStatus.DRAFT,
        phases: [phase],
        name: 'Neighbourhood Fund',
      }),
    );

    expect(refresh).not.toHaveBeenCalled();
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
