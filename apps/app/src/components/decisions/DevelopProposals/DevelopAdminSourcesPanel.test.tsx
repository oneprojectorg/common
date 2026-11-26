// @vitest-environment jsdom
import type { InstancePhaseData } from '@op/api/encoders';
import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import messages from '../../../lib/i18n/dictionaries/en.json';
import { DevelopAdminSourcesPanel } from './DevelopAdminSourcesPanel';

let lock: 'windowClosed' | null = null;
const prepareMutate = vi.fn();
const submitMutate = vi.fn();
const unsubmitMutate = vi.fn();

function idleMutation(mutate: () => void) {
  return { mutate, isPending: false, variables: undefined };
}

vi.mock('@op/api/client', () => ({
  trpc: {
    decision: {
      getCategories: {
        useSuspenseQuery: () => [{ items: [] }],
      },
      getDevelopConfirmState: {
        useSuspenseQuery: () => [{ lock }],
      },
      listDevelopSources: {
        useSuspenseInfiniteQuery: () => [
          { pages: [{ items: sources, total: sources.length }] },
          {
            fetchNextPage: vi.fn(),
            hasNextPage: false,
            isFetchingNextPage: false,
          },
        ],
      },
      createDevelopedProposal: {
        useMutation: () => idleMutation(prepareMutate),
      },
      submitDevelopedProposal: {
        useMutation: () => idleMutation(submitMutate),
      },
      unsubmitDevelopedProposal: {
        useMutation: () => idleMutation(unsubmitMutate),
      },
    },
  },
}));

vi.mock('nuqs', () => ({
  parseAsString: { withDefault: () => ({}) },
  useQueryState: () => ['all-categories', vi.fn()],
}));

vi.mock('@/lib/i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/i18n')>()),
  useRouter: () => ({ push: vi.fn() }),
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('../proposalReviewDecoration', () => ({
  ProposalReviewDecorationProvider: ({ children }: { children: ReactNode }) =>
    children,
  useReportProposalsForReviewDecoration: () => {},
  useProposalReviewAggregates: () => ({ status: 'unavailable' }),
}));

vi.mock('../CategoryFilterSelect', () => ({
  CategoryFilterSelect: () => null,
}));

const sourcePhase: InstancePhaseData = {
  phaseId: 'review',
  name: 'Review',
  rules: {},
};

const source = ({
  id,
  name,
  developedProposals,
}: {
  id: string;
  name: string;
  developedProposals: { id: string; profileId: string; status: string }[];
}) => ({
  id,
  profileId: `${id}-profile`,
  profile: { name },
  submittedBy: null,
  proposalData: { category: [] },
  developedProposals,
});

const sources = [
  source({
    id: 'draft-source',
    name: 'Draft source',
    developedProposals: [
      { id: 'draft-entry', profileId: 'draft-entry-profile', status: 'draft' },
    ],
  }),
  source({
    id: 'submitted-source',
    name: 'Submitted source',
    developedProposals: [
      {
        id: 'submitted-entry',
        profileId: 'submitted-entry-profile',
        status: 'submitted',
      },
    ],
  }),
  source({
    id: 'empty-source',
    name: 'Empty source',
    developedProposals: [],
  }),
];

function renderPanel() {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <DevelopAdminSourcesPanel
        processInstanceId="instance"
        sourcePhase={sourcePhase}
        decisionSlug="decision"
      />
    </NextIntlClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  lock = null;
  prepareMutate.mockClear();
  submitMutate.mockClear();
  unsubmitMutate.mockClear();
});

describe('DevelopAdminSourcesPanel', () => {
  it('offers the author actions on each entry while the develop window is open', () => {
    renderPanel();

    expect(
      screen.getByRole('link', { name: 'Edit Draft source' }),
    ).toHaveProperty('href', expect.stringContaining('draft-entry-profile'));
    screen.getByRole('button', { name: 'Advance Draft source' }).click();
    expect(submitMutate).toHaveBeenCalledWith({ proposalId: 'draft-entry' });

    screen
      .getByRole('button', { name: 'Submitted source is advanced' })
      .click();
    expect(unsubmitMutate).toHaveBeenCalledWith({
      proposalId: 'submitted-entry',
    });

    // The title prepares too; the second control is the actions cell's.
    const prepareControls = screen.getAllByRole('button', {
      name: 'Prepare Empty source',
    });
    expect(prepareControls).toHaveLength(2);
    prepareControls[1]?.click();
    expect(prepareMutate).toHaveBeenCalledWith(
      expect.objectContaining({ sourceProposalIds: ['empty-source'] }),
    );
    expect(screen.queryByText('Advancing')).toBeNull();
  });

  it('shows only whether each source is advancing once the develop window closed', () => {
    lock = 'windowClosed';
    renderPanel();

    expect(screen.queryByRole('link', { name: /^Edit / })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Advance / })).toBeNull();
    expect(screen.getByText('Advancing')).toBeTruthy();
    expect(screen.getAllByText('Under consideration')).toHaveLength(2);
  });
});
