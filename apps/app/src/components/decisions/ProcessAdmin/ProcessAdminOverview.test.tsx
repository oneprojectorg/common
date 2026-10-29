// @vitest-environment jsdom
import { ProcessStatus } from '@op/api/encoders';
import {
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

const { query, updateInstance } = vi.hoisted(() => {
  const query: {
    decisionProfile: unknown;
    resources: unknown[];
    userProfiles: { id: string; name: string }[];
  } = {
    decisionProfile: null,
    resources: [],
    userProfiles: [],
  };
  return { query, updateInstance: vi.fn() };
});

vi.mock('@op/api/client', () => ({
  trpc: {
    useUtils: () => ({
      decision: { getDecisionBySlug: { invalidate: async () => {} } },
    }),
    account: {
      getUserProfiles: {
        useSuspenseQuery: () => [{ items: query.userProfiles }],
      },
    },
    decision: {
      getDecisionBySlug: {
        useSuspenseQuery: () => [query.decisionProfile],
      },
      updateDecisionInstance: {
        // Records the input, then settles at once so callers' callbacks run.
        useMutation: () => ({
          mutate: (
            input: object,
            options?: { onSuccess?: () => void; onSettled?: () => void },
          ) => {
            updateInstance(input);
            options?.onSuccess?.();
            options?.onSettled?.();
          },
          isPending: false,
        }),
      },
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

const seed = ({
  status = ProcessStatus.PUBLISHED,
  description = null,
  phases = [],
  steward = null,
  owner = null,
  heroImage,
  body,
  isPrivate = false,
}: {
  status?: string;
  description?: string | null;
  phases?: object[];
  steward?: object | null;
  owner?: object | null;
  heroImage?: string;
  body?: string | object;
  isPrivate?: boolean;
}) => {
  query.decisionProfile = {
    name: 'Community Fund',
    processInstance: {
      id: 'instance-1',
      profileId: 'profile-1',
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
  };
};

const renderOverview = (isOpen = false, aboutSlot: ReactNode = null) =>
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <ProcessAdminOverview slug={SLUG} isOpen={isOpen} aboutSlot={aboutSlot} />
    </NextIntlClientProvider>,
  );

const phase = {
  phaseId: 'submit',
  name: 'Submit',
  startDate: '2026-01-01T00:00:00.000Z',
};

afterEach(() => {
  cleanup();
  query.resources = [];
  query.userProfiles = [];
  updateInstance.mockClear();
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

  it('saves a renamed draft title on Enter and refuses one below the minimum', async () => {
    seed({ status: ProcessStatus.DRAFT });
    renderOverview();
    const user = userEvent.setup();

    await user.click(
      screen.getByRole('button', { name: 'Edit Community Fund' }),
    );
    await user.keyboard('Neighbourhood Fund{Enter}');

    expect(updateInstance).toHaveBeenCalledTimes(1);
    expect(updateInstance.mock.calls[0]?.[0]).toEqual({
      instanceId: 'instance-1',
      name: 'Neighbourhood Fund',
    });

    // The mock settles at once and the query is not refetched, so the title
    // reads the stored name again.
    await user.click(
      screen.getByRole('button', { name: 'Edit Community Fund' }),
    );
    await user.keyboard('ab{Enter}');

    expect(updateInstance).toHaveBeenCalledTimes(1);
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

    expect(updateInstance).toHaveBeenCalledTimes(1);
    expect(updateInstance).toHaveBeenCalledWith({
      instanceId: 'instance-1',
      name: 'New Fund',
    });
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
    expect(updateInstance).not.toHaveBeenCalled();
  });

  it('saves the visibility as it is chosen', async () => {
    seed({});
    renderOverview();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(await screen.findByRole('tab', { name: 'Visibility' }));
    await user.click(await screen.findByRole('radio', { name: /Unlisted/ }));

    expect(updateInstance.mock.calls[0]?.[0]).toEqual({
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

    expect(updateInstance).toHaveBeenCalledWith({
      instanceId: 'instance-1',
      stewardProfileId: 'org-2',
    });
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

    expect(updateInstance).toHaveBeenCalledTimes(1);
    expect(updateInstance.mock.calls[0]?.[0]).toEqual({
      instanceId: 'instance-1',
      overview: { body: paragraphDoc('Grants for the neighbourhood') },
    });
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

    expect(updateInstance).not.toHaveBeenCalled();
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
    expect(updateInstance).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Discard' }));

    expect(updateInstance).not.toHaveBeenCalled();
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
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      seed({ status: ProcessStatus.DRAFT });
      renderOverview();

      expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
      fireEvent.change(aboutField(), { target: { value: 'a' } });
      fireEvent.change(aboutField(), { target: { value: 'ab' } });
      vi.advanceTimersByTime(999);
      expect(updateInstance).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);

      expect(updateInstance).toHaveBeenCalledTimes(1);
      expect(updateInstance.mock.calls[0]?.[0]).toEqual({
        instanceId: 'instance-1',
        overview: { body: paragraphDoc('ab') },
      });
    } finally {
      vi.useRealTimers();
    }
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
