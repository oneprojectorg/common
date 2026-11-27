// @vitest-environment jsdom
import { ProcessStatus } from '@op/api/encoders';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
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
      userProfiles: { id: string; name: string }[];
      error: Error | null;
    } = {
      decisionProfile: null,
      resources: [],
      userProfiles: [],
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
      onSuccess?: (saved: unknown, input: unknown) => unknown;
      onError?: (error: Error) => unknown;
      onSettled?: (saved: unknown, error: Error | null) => unknown;
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
                await hook.onSettled?.(undefined, error);
                await call.onError?.(error);
              } else {
                await hook.onSuccess?.(saved, input);
                await hook.onSettled?.(saved, null);
                await call.onSuccess?.(saved, input);
              }
              await call.onSettled?.(saved, error ?? null);
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
    account: {
      getUserProfiles: {
        useSuspenseQuery: () => [{ items: query.userProfiles }],
      },
    },
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
vi.mock('./ProcessAdminsDialog', () => ({
  ProcessAdminsDialog: ({ profileId }: { profileId: string }) => (
    <button type="button" data-profile-id={profileId}>
      Manage admins
    </button>
  ),
}));
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

// TipTap needs a real DOM selection; a textarea seeded from `content` that
// emits a one-paragraph doc is enough to drive open, type and commit.
const paragraphDoc = (text: string) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});
vi.mock('@tiptap/core', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  generateJSON: (html: string) => paragraphDoc(html),
}));
vi.mock('@op/sense/RichTextEditor', () => ({
  RichTextEditor: ({
    content,
    placeholder,
    ariaLabelledBy,
    onChangeJSON,
  }: {
    content?: string | object;
    placeholder?: string;
    ariaLabelledBy?: string;
    onChangeJSON?: (json: object) => void;
  }) => (
    <textarea
      aria-labelledby={ariaLabelledBy}
      placeholder={placeholder}
      defaultValue={
        typeof content === 'string' ? content : JSON.stringify(content)
      }
      onChange={(event) => onChangeJSON?.(paragraphDoc(event.target.value))}
    />
  ),
  RichTextViewer: ({ content }: { content: object }) => (
    <div data-testid="about-viewer">{JSON.stringify(content)}</div>
  ),
}));
vi.mock('@/components/RichTextEditor', () => ({
  RichTextEditorBubbleMenu: () => null,
}));
vi.mock('@/components/RichTextEditor/editorConfig', () => ({
  getProposalExtensions: () => [],
}));

const SLUG = 'community-fund';

const profile = ({
  status = ProcessStatus.PUBLISHED,
  description = null,
  phases = [],
  steward = null,
  owner = null,
  heroImage,
  body,
  isPrivate = false,
  name = 'Community Fund',
  profileId = 'profile-1',
}: {
  name?: string;
  profileId?: string | null;
  status?: string;
  description?: string | null;
  phases?: object[];
  steward?: object | null;
  owner?: object | null;
  heroImage?: string;
  body?: string | object;
  isPrivate?: boolean;
}) => ({
  name,
  processInstance: {
    id: 'instance-1',
    profileId,
    status,
    description,
    currentStateId: null,
    steward,
    owner,
    instanceData: {
      phases,
      config: { isPrivate },
      overview: heroImage || body ? { heroImage, body } : undefined,
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
  phaseId: 'submit',
  name: 'Submit',
  startDate: '2026-01-01T00:00:00.000Z',
};

afterEach(() => {
  cleanup();
  query.resources = [];
  query.userProfiles = [];
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

  it('gives a draft its admins and an inert launch, not Settings', () => {
    seed({ status: ProcessStatus.DRAFT });
    renderOverview();

    expect(screen.getByRole('button', { name: 'Manage admins' })).toBeTruthy();
    expect(
      screen
        .getByRole('button', { name: 'Launch process' })
        .getAttribute('aria-disabled'),
    ).toBe('true');
    expect(screen.queryByRole('button', { name: 'Settings' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'View process' })).toBeNull();
  });

  it('opens the admins of the process it shows', () => {
    seed({ status: ProcessStatus.DRAFT, profileId: 'profile-7' });
    renderOverview();

    expect(
      screen
        .getByRole('button', { name: 'Manage admins' })
        .getAttribute('data-profile-id'),
    ).toBe('profile-7');
  });

  it('keeps the launch but offers no admins when the process has no profile', () => {
    seed({ status: ProcessStatus.DRAFT, profileId: null });
    renderOverview();

    expect(screen.queryByRole('button', { name: 'Manage admins' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Launch process' })).toBeTruthy();
  });

  it('gives a live process Settings and the public view, not a launch', () => {
    seed({});
    renderOverview();

    expect(screen.getByRole('button', { name: 'Settings' })).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'View process' }).getAttribute('href'),
    ).toContain(`/decisions/${SLUG}`);
    expect(screen.queryByRole('button', { name: 'Launch process' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Manage admins' })).toBeNull();
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

  it('saves the name from Settings once for Enter and the blur after it', async () => {
    seed({});
    renderOverview();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const field = await screen.findByRole('textbox', { name: 'Process name' });
    await user.clear(field);
    await user.type(field, 'New Fund{Enter}');
    await user.tab();

    expect(updateInstance.mutate).toHaveBeenCalledTimes(1);
    expect(updateInstance.mutate).toHaveBeenCalledWith(
      { instanceId: 'instance-1', name: 'New Fund' },
      expect.anything(),
    );
  });

  it('retries a Settings rename on the next blur after the save fails', async () => {
    seed({});
    renderOverview();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const field = await screen.findByRole('textbox', { name: 'Process name' });
    await user.clear(field);
    await user.type(field, 'New Fund{Enter}');
    await failSave();
    await user.tab();

    expect(field).toHaveProperty('value', 'New Fund');
    expect(updateInstance.mutate).toHaveBeenCalledTimes(2);
    expect(updateInstance.mutate).toHaveBeenLastCalledWith(
      { instanceId: 'instance-1', name: 'New Fund' },
      expect.anything(),
    );
  });

  it('keeps a too-short name out of Settings saves and says why', async () => {
    seed({});
    renderOverview();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const field = await screen.findByRole('textbox', { name: 'Process name' });
    await user.clear(field);
    await user.type(field, 'ab');
    await user.tab();

    expect(
      screen.getByText('The name needs at least 3 characters.'),
    ).toBeTruthy();
    expect(updateInstance.mutate).not.toHaveBeenCalled();
  });

  it('saves the visibility as it is chosen', async () => {
    seed({});
    renderOverview();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(await screen.findByRole('tab', { name: 'Visibility' }));
    await user.click(await screen.findByRole('radio', { name: /Unlisted/ }));

    expect(updateInstance.mutate.mock.calls[0]?.[0]).toEqual({
      instanceId: 'instance-1',
      config: { isPrivate: true },
    });
  });

  it('lets an admin of the owner pick a draft steward from their profiles', async () => {
    query.userProfiles = [
      { id: 'me', name: 'Me' },
      { id: 'org-1', name: 'East Side Collective' },
      { id: 'org-2', name: 'West End Trust' },
    ];
    seed({
      status: ProcessStatus.DRAFT,
      steward: { id: 'org-1', name: 'East Side Collective' },
      owner: { id: 'org-1' },
    });
    renderOverview();
    const user = userEvent.setup();

    const trigger = await screen.findByRole('button', {
      name: 'East Side Collective',
      description: 'Change who is stewarding this',
    });
    await user.click(trigger);
    await user.click(
      await screen.findByRole('menuitem', { name: /West End Trust/ }),
    );

    expect(updateInstance.mutate.mock.calls[0]?.[0]).toEqual({
      instanceId: 'instance-1',
      stewardProfileId: 'org-2',
    });
  });

  it('shows the chosen steward in Settings while it saves and the stored one when it fails', async () => {
    query.userProfiles = [
      { id: 'org-1', name: 'East Side Collective' },
      { id: 'org-2', name: 'West End Trust' },
    ];
    seed({
      steward: { id: 'org-1', name: 'East Side Collective' },
      owner: { id: 'org-1' },
    });
    renderOverview();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const select = await screen.findByRole('combobox', {
      name: 'Stewarded by',
    });
    await user.click(select);
    await user.click(
      await screen.findByRole('option', { name: /West End Trust/ }),
    );

    expect(select.textContent).toContain('West End Trust');

    await failSave();

    expect(select.textContent).toContain('East Side Collective');
  });

  it('shows the steward as plain text when the admin does not administer the owner', async () => {
    query.userProfiles = [
      { id: 'me', name: 'Me' },
      { id: 'org-1', name: 'East Side Collective' },
    ];
    seed({
      status: ProcessStatus.DRAFT,
      steward: { id: 'org-1', name: 'East Side Collective' },
      owner: { id: 'org-9' },
    });
    renderOverview();

    const name = await screen.findByText('East Side Collective');
    expect(name.closest('button')).toBeNull();
  });

  const aboutField = () =>
    screen.getByRole('textbox', { name: 'About the process' });

  it('edits the About body of a live process behind Edit and saves on Done', async () => {
    seed({ description: 'Plain description' });
    renderOverview();
    const user = userEvent.setup();

    expect(
      screen.queryByRole('textbox', { name: 'About the process' }),
    ).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.type(aboutField(), 'Grants for the neighbourhood');
    await user.click(screen.getByRole('button', { name: 'Done' }));

    expect(updateInstance.mutate).toHaveBeenCalledTimes(1);
    expect(updateInstance.mutate.mock.calls[0]?.[0]).toEqual({
      instanceId: 'instance-1',
      overview: { body: paragraphDoc('Grants for the neighbourhood') },
    });
    await succeedSave(
      profile({
        description: 'Plain description',
        body: paragraphDoc('Grants for the neighbourhood'),
      }),
    );
    expect(
      screen.queryByRole('textbox', { name: 'About the process' }),
    ).toBeNull();
    expect(screen.getByTestId('about-viewer').textContent).toContain(
      'Grants for the neighbourhood',
    );
  });

  it('seeds the editor from a legacy HTML body and saves nothing on an unchanged Done', async () => {
    seed({ body: '<p>Legacy body</p>' });
    renderOverview();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByDisplayValue('<p>Legacy body</p>')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Done' }));

    expect(updateInstance.mutate).not.toHaveBeenCalled();
  });

  it('asks before a dirty edit is abandoned by a click elsewhere', async () => {
    seed({});
    renderOverview();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.type(aboutField(), 'Half a sentence');
    await user.click(screen.getByRole('link', { name: 'View process' }));

    const dialog = await screen.findByRole('alertdialog', {
      name: 'Keep your changes?',
    });
    expect(updateInstance.mutate).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Discard' }));

    expect(updateInstance.mutate).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('textbox', { name: 'About the process' }),
    ).toBeNull();
  });

  it('closes a clean edit silently on a click elsewhere', async () => {
    seed({});
    renderOverview();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('link', { name: 'View process' }));

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(
      screen.queryByRole('textbox', { name: 'About the process' }),
    ).toBeNull();
  });

  it('saves a draft About body after a pause, once, with the last text', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    try {
      seed({ status: ProcessStatus.DRAFT });
      renderOverview();

      expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
      fireEvent.change(aboutField(), { target: { value: 'a' } });
      fireEvent.change(aboutField(), { target: { value: 'ab' } });
      vi.advanceTimersByTime(999);
      expect(updateInstance.mutate).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);

      expect(updateInstance.mutate).toHaveBeenCalledTimes(1);
      expect(updateInstance.mutate.mock.calls[0]?.[0]).toEqual({
        instanceId: 'instance-1',
        overview: { body: paragraphDoc('ab') },
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('sends a draft About edit when the page is left inside the pause', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    try {
      seed({ status: ProcessStatus.DRAFT });
      const { unmount } = renderOverview();

      fireEvent.change(aboutField(), { target: { value: 'gone' } });
      expect(updateInstance.mutate).not.toHaveBeenCalled();
      unmount();

      expect(updateInstance.mutate).toHaveBeenCalledTimes(1);
      expect(updateInstance.mutate.mock.calls[0]?.[0]).toEqual({
        instanceId: 'instance-1',
        overview: { body: paragraphDoc('gone') },
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows the chosen visibility while it saves and the saved one when it fails', async () => {
    seed({});
    renderOverview();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(await screen.findByRole('tab', { name: 'Visibility' }));
    await user.click(await screen.findByRole('radio', { name: /Unlisted/ }));

    expect(
      screen
        .getByRole('radio', { name: /Unlisted/ })
        .getAttribute('aria-checked'),
    ).toBe('true');

    await failSave();

    expect(
      screen
        .getByRole('radio', { name: /Public/ })
        .getAttribute('aria-checked'),
    ).toBe('true');
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
