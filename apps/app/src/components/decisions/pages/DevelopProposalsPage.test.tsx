// @vitest-environment jsdom
import type { InstancePhaseData, ProcessInstance } from '@op/api/encoders';
import type { OwnDevelopedProposal, Proposal } from '@op/common/client';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import messages from '../../../lib/i18n/dictionaries/en.json';
import { DevelopProposalsPage } from './DevelopProposalsPage';

const mutate = vi.fn();
const push = vi.fn();
let origins: Proposal[] = [];
let entries: OwnDevelopedProposal[] = [];

vi.mock('@op/api/client', () => ({
  trpc: {
    useUtils: () => ({
      decision: {
        listProposals: { invalidate: vi.fn() },
        listOwnDevelopedProposals: { invalidate: vi.fn() },
        getInstance: { invalidate: vi.fn() },
      },
    }),
    useSuspenseQueries: () => [
      [
        { items: [] },
        { items: origins, total: origins.length, next: null },
        { items: entries },
      ],
    ],
    decision: {
      createDevelopedProposal: {
        useMutation: () => ({ mutate, isPending: false, variables: undefined }),
      },
      submitDevelopedProposal: {
        useMutation: () => ({
          mutate: vi.fn(),
          isPending: false,
          variables: undefined,
        }),
      },
    },
  },
}));

vi.mock('@/lib/i18n', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/i18n')>()),
  useRouter: () => ({ push }),
  // The i18n Link needs a mounted app router; an anchor keeps the href.
  Link: (props: React.ComponentProps<'a'>) => <a {...props} />,
}));

const phases: InstancePhaseData[] = [
  { phaseId: 'review', name: 'Review', rules: { proposals: { review: true } } },
  {
    phaseId: 'develop',
    name: 'Develop',
    rules: { proposals: { develop: true } },
  },
];

const buildProposal = ({
  id,
  title,
  status = 'submitted',
  category = [],
}: {
  id: string;
  title: string;
  status?: string;
  category?: string[];
}): Proposal => ({
  id,
  processInstanceId: 'instance-id',
  profileId: `${id}-profile`,
  status,
  visibility: 'visible',
  profile: { name: title },
  submittedBy: {
    id: `${id}-author`,
    slug: `${id}-author`,
    name: `Author of ${title}`,
  },
  proposalData: {
    title,
    category,
    budget: { amount: 1200, currency: 'USD' },
    attachmentIds: [],
  },
});

const buildEntry = ({
  id,
  title,
  status = 'submitted',
}: {
  id: string;
  title: string;
  status?: string;
}): OwnDevelopedProposal => ({
  id,
  profileId: `${id}-profile`,
  status,
  visibility: 'hidden',
  title,
  category: [],
  budget: null,
  origins: [{ id: 'origin', name: 'Origin' }],
});

const renderPage = () => {
  const instance: ProcessInstance = {
    id: 'instance-id',
    slug: 'decision-slug',
    name: 'Decision',
    description: null,
    profileId: null,
    status: 'published',
    createdAt: null,
    updatedAt: null,
    currentStateId: 'develop',
    instanceData: { phases },
  };

  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <DevelopProposalsPage instance={instance} />
    </NextIntlClientProvider>,
  );
};

describe('DevelopProposalsPage', () => {
  beforeEach(() => {
    origins = [];
    entries = [];
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('lists the previous phase proposals with their submitter and count', () => {
    origins = [
      buildProposal({ id: 'a', title: 'Fix the park', category: ['Parks'] }),
      buildProposal({ id: 'b', title: 'Paint the school' }),
    ];
    renderPage();

    expect(screen.getByText('Fix the park')).toBeTruthy();
    expect(screen.getByText('Author of Fix the park')).toBeTruthy();
    expect(screen.getByText('Paint the school')).toBeTruthy();
    expect(screen.getByText('2 proposals')).toBeTruthy();
  });

  it('prepares an entry from an origin with its title and category', () => {
    origins = [
      buildProposal({ id: 'a', title: 'Fix the park', category: ['Parks'] }),
    ];
    renderPage();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Prepare an entry from Fix the park',
      }),
    );

    expect(mutate).toHaveBeenCalledWith({
      processInstanceId: 'instance-id',
      sourceProposalIds: ['a'],
      proposalData: { title: 'Fix the park', category: ['Parks'] },
    });
  });

  it('shows an empty state when the previous phase has no proposals', () => {
    renderPage();

    expect(screen.getByText('No proposals to develop')).toBeTruthy();
    expect(screen.getByText('0 proposals')).toBeTruthy();
  });

  it('lists the entries of the current phase, drafts included, with their editor link', () => {
    entries = [
      buildEntry({ id: 'e1', title: 'Park entry', status: 'draft' }),
      buildEntry({ id: 'e2', title: 'School entry' }),
    ];
    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: /Ballot/ }));

    expect(screen.getByText('2 ballot entries')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'School entry' })).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Park entry' }).getAttribute('href'),
    ).toContain('/decisions/decision-slug/proposal/e1-profile/edit');
  });
});
