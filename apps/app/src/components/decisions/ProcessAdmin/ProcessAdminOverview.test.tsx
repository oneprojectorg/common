// @vitest-environment jsdom
import { ProcessStatus } from '@op/api/encoders';
import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import en from '../../../lib/i18n/dictionaries/en.json';
import { ProcessAdminOverview } from './ProcessAdminOverview';

const { query } = vi.hoisted(() => {
  const query: { decisionProfile: unknown; resources: unknown[] } = {
    decisionProfile: null,
    resources: [],
  };
  return { query };
});

vi.mock('@op/api/client', () => ({
  trpc: {
    decision: {
      getDecisionBySlug: {
        useSuspenseQuery: () => [query.decisionProfile],
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

const SLUG = 'community-fund';

const seed = ({
  status = ProcessStatus.PUBLISHED,
  description = null,
  phases = [],
  body,
  steward = null,
}: {
  status?: string;
  description?: string | null;
  phases?: object[];
  body?: unknown;
  steward?: object | null;
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
      instanceData: { phases, overview: body ? { body } : undefined },
    },
  };
};

const renderOverview = (hasStarted = false) =>
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <ProcessAdminOverview slug={SLUG} hasStarted={hasStarted} />
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

  it('treats a cleared About body as empty', () => {
    seed({ body: { type: 'doc', content: [{ type: 'paragraph' }] } });
    renderOverview();

    expect(screen.getByText('No description yet')).toBeTruthy();
  });

  it('renders the About body over the plain description', async () => {
    seed({
      description: 'Plain description',
      body: {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Rich body' }] },
        ],
      },
    });
    renderOverview();

    expect(await screen.findByText('Rich body')).toBeTruthy();
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

  it('links to the proposals once a live process has started', () => {
    seed({ phases: [phase] });
    renderOverview(true);

    expect(
      screen
        .getByRole('link', { name: 'Browse proposals' })
        .getAttribute('href'),
    ).toContain(`/decisions/${SLUG}/current`);
  });

  it('hides the proposals link before the process starts', () => {
    seed({ phases: [phase] });
    renderOverview(false);

    expect(screen.queryByRole('link', { name: 'Browse proposals' })).toBeNull();
  });

  it('hides the proposals link on a draft, even with a past start date', () => {
    seed({ status: ProcessStatus.DRAFT, phases: [phase] });
    renderOverview(true);

    expect(screen.queryByRole('link', { name: 'Browse proposals' })).toBeNull();
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
});
