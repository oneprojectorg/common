// @vitest-environment jsdom
import { processInstanceWithSchemaEncoder } from '@op/api/encoders';
import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { randomUUID } from 'node:crypto';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import messages from '../../../lib/i18n/dictionaries/en.json';
import { DevelopAdminCategoryPage } from './DevelopAdminCategoryPage';

let lock: 'windowClosed' | null = null;
const prepareMutate = vi.fn();
const submitMutate = vi.fn();
const unsubmitMutate = vi.fn();
const listDevelopSources = vi.fn();

function idleMutation(mutate: () => void) {
  return { mutate, isPending: false, variables: undefined };
}

vi.mock('@op/api/client', () => ({
  trpc: {
    useSuspenseQueries: () => [
      [{ items: [{ category: { id: 'parks', name: 'Parks' } }] }, { lock }],
    ],
    decision: {
      listDevelopSources: {
        useSuspenseInfiniteQuery: (input: unknown) => {
          listDevelopSources(input);
          return [
            { pages: [{ items: sources, total: sources.length }] },
            {
              fetchNextPage: vi.fn(),
              hasNextPage: false,
              isFetchingNextPage: false,
            },
          ];
        },
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

const instance = processInstanceWithSchemaEncoder.parse({
  id: randomUUID(),
  profileId: randomUUID(),
  name: 'Decision',
  description: null,
  currentStateId: 'develop',
  status: 'published',
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-01T00:00:00.000Z',
  instanceData: {
    phases: [
      { phaseId: 'review', rules: {} },
      { phaseId: 'develop', rules: { proposals: { develop: true } } },
    ],
  },
  access: {
    delete: true,
    update: true,
    read: true,
    create: true,
    admin: true,
    inviteMembers: true,
    review: false,
    submitProposals: false,
    vote: false,
    developProposals: false,
  },
});

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
  source({ id: 'empty-source', name: 'Empty source', developedProposals: [] }),
];

function renderPage() {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <DevelopAdminCategoryPage
        instance={instance}
        sourcePhase={{ phaseId: 'review', rules: {} }}
        decisionSlug="decision"
        categoryId="parks"
        onBack={vi.fn()}
      />
    </NextIntlClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  lock = null;
  vi.clearAllMocks();
});

describe('DevelopAdminCategoryPage', () => {
  it('lists the sources of its category with the author actions while the develop window is open', () => {
    renderPage();

    expect(listDevelopSources).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'all', categoryIds: ['parks'] }),
    );
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(
      '3 proposals in Parks',
    );

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

    screen.getByRole('button', { name: 'Prepare Empty source' }).click();
    expect(prepareMutate).toHaveBeenCalledWith(
      expect.objectContaining({ sourceProposalIds: ['empty-source'] }),
    );
  });

  it('shows only whether each source advances once the develop window closed', () => {
    lock = 'windowClosed';
    renderPage();

    expect(screen.queryByRole('link', { name: /^Edit / })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Advance / })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Prepare / })).toBeNull();
    expect(screen.getByText('Advancing')).toBeTruthy();
    expect(screen.getAllByText('Not advanced')).toHaveLength(2);
  });
});
