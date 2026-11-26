// @vitest-environment jsdom
import { processInstanceWithSchemaEncoder } from '@op/api/encoders';
import { cleanup, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { randomUUID } from 'node:crypto';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import messages from '../../../lib/i18n/dictionaries/en.json';
import { DevelopAdminCategoryPage } from './DevelopAdminCategoryPage';

let lock: 'windowClosed' | null = null;
let categoryStatus = buildCategoryStatus({});
const prepareMutate = vi.fn();
const confirmMutate = vi.fn();
const unconfirmMutate = vi.fn();
const submitMutate = vi.fn();
const unsubmitMutate = vi.fn();
const listDevelopSources = vi.fn();

function idleMutation(mutate: () => void) {
  return { mutate, isPending: false, variables: undefined };
}

vi.mock('@op/api/client', () => ({
  trpc: {
    useSuspenseQueries: () => [[{ items: [categoryStatus] }, { lock }]],
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
      confirmCategoryDevelopment: {
        useMutation: () => idleMutation(confirmMutate),
      },
      unconfirmCategoryDevelopment: {
        useMutation: () => idleMutation(unconfirmMutate),
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
  developedProposals: {
    id: string;
    profileId: string;
    status: string;
    isSubmittable: boolean;
  }[];
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
      {
        id: 'draft-entry',
        profileId: 'draft-entry-profile',
        status: 'draft',
        isSubmittable: true,
      },
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
        isSubmittable: false,
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

function buildCategoryStatus({
  advancingCount = 1,
  reviewers = [{ developConfirmedAt: null }],
}: {
  advancingCount?: number;
  reviewers?: { developConfirmedAt: string | null }[];
}) {
  return {
    category: { id: 'parks', name: 'Parks', termUri: 'parks' },
    reviewers,
    sourceCount: 3,
    advancingCount,
  };
}

function getFooterAction(name: string) {
  return within(screen.getByRole('contentinfo')).queryByRole('button', {
    name,
  });
}

afterEach(() => {
  cleanup();
  lock = null;
  categoryStatus = buildCategoryStatus({});
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
    expect(screen.queryByRole('contentinfo')).toBeNull();
  });

  it('confirms the whole category by its taxonomy term after the dialog', async () => {
    renderPage();

    expect(screen.getByRole('contentinfo').textContent).toContain(
      '1 proposal advancing',
    );
    getFooterAction('Confirm selections')?.click();
    const dialog = await screen.findByRole('dialog');
    within(dialog).getByRole('button', { name: 'Confirm selections' }).click();

    expect(confirmMutate).toHaveBeenCalledWith({
      processInstanceId: instance.id,
      taxonomyTermId: 'parks',
    });
  });

  it('disables Confirm while nothing in the category advances', () => {
    categoryStatus = buildCategoryStatus({ advancingCount: 0 });
    renderPage();

    expect(getFooterAction('Confirm selections')).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('offers Unconfirm once every reviewer of the category confirmed', async () => {
    categoryStatus = buildCategoryStatus({
      reviewers: [{ developConfirmedAt: '2026-11-20T00:00:00.000Z' }],
    });
    renderPage();

    // The rows stay editable for the admin after the confirm.
    expect(
      screen.getByRole('button', { name: 'Advance Draft source' }),
    ).toBeTruthy();
    expect(getFooterAction('Confirm selections')).toBeNull();
    getFooterAction('Unconfirm selections')?.click();
    const dialog = await screen.findByRole('dialog');
    within(dialog)
      .getByRole('button', { name: 'Unconfirm selections' })
      .click();

    expect(unconfirmMutate).toHaveBeenCalledWith({
      processInstanceId: instance.id,
      taxonomyTermId: 'parks',
    });
  });

  it('offers no confirm for a category without reviewers', () => {
    categoryStatus = buildCategoryStatus({ reviewers: [] });
    renderPage();

    expect(getFooterAction('Confirm selections')).toBeNull();
    expect(getFooterAction('Unconfirm selections')).toBeNull();
  });
});
