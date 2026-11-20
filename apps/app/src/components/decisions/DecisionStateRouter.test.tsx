// @vitest-environment jsdom
import type { InstancePhaseData, ProcessInstance } from '@op/api/encoders';
import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import messages from '../../lib/i18n/dictionaries/en.json';
import { DecisionStateRouter } from './DecisionStateRouter';

const useSuspenseQuery = vi.fn();

vi.mock('@op/api/client', () => ({
  trpc: {
    decision: {
      getInstance: { useSuspenseQuery: () => useSuspenseQuery() },
    },
  },
}));

// The router only picks a page; the pages and the sheet each own their
// queries, so they're stubbed to a marker.
vi.mock('./ProposalSheet/ProposalSheetProvider', () => ({
  ProposalSheetProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));
vi.mock('./ProposalSheet/ProposalSheet', () => ({
  ProposalSheet: () => null,
}));
vi.mock('./ProposalSheet/ReviewProgressProposalSheet', () => ({
  ReviewProgressProposalSheet: () => null,
}));
vi.mock('./ProposalSheet/ReadOnlyProposalSheet', () => ({
  ReadOnlyProposalSheet: () => null,
}));
vi.mock('./pages/useReviewTab', () => ({
  useReviewTab: () => ({ showsAllProposals: false }),
}));
vi.mock('./pages/StandardDecisionPage', () => ({
  StandardDecisionPage: () => <div>standard page</div>,
}));
vi.mock('./pages/ReviewSelectionPage', () => ({
  ReviewSelectionPage: () => <div>review selection page</div>,
}));
vi.mock('./pages/DevelopProposalsPage', () => ({
  DevelopProposalsPage: () => <div>develop page</div>,
}));
vi.mock('./pages/DevelopCoauthorPage', () => ({
  DevelopCoauthorPage: () => <div>develop co-author page</div>,
}));
vi.mock('./pages/DevelopPreparationPage', () => ({
  DevelopPreparationPage: () => <div>develop preparation page</div>,
}));
vi.mock('./pages/DevelopAdminPage', () => ({
  DevelopAdminPage: () => <div>develop admin page</div>,
}));
vi.mock('./pages/FinalPhaseManualSelectionPage', () => ({
  FinalPhaseManualSelectionPage: () => <div>final selection page</div>,
}));

type Phase = InstancePhaseData;
type Access = NonNullable<ProcessInstance['access']>;

const noAccess: Access = {
  delete: false,
  update: false,
  read: true,
  create: false,
  admin: false,
  inviteMembers: false,
  review: false,
  submitProposals: false,
  vote: false,
  developProposals: false,
};

const reviewPhase: Phase = {
  phaseId: 'review',
  name: 'Review',
  rules: { proposals: { review: true } },
};

const developPhase: Phase = {
  phaseId: 'develop',
  name: 'Develop',
  rules: { proposals: { develop: true } },
};

const votePhase: Phase = {
  phaseId: 'vote',
  name: 'Vote',
  rules: { voting: { submit: true } },
};

const resultsPhase: Phase = {
  phaseId: 'results',
  name: 'Results',
  rules: {},
};

const renderRouter = ({
  phases,
  currentStateId,
  access,
  selectionsAreConfirmed = false,
}: {
  phases: Array<Phase>;
  currentStateId: string;
  access: Partial<Access>;
  selectionsAreConfirmed?: boolean;
}) => {
  useSuspenseQuery.mockReturnValue([
    {
      id: 'instance',
      currentStateId,
      selectionsAreConfirmed,
      access: { ...noAccess, ...access },
      instanceData: { phases },
    },
  ]);
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <DecisionStateRouter
        instanceId="instance"
        slug="org"
        decisionSlug="decision"
      />
    </NextIntlClientProvider>,
  );
};

const reviewThenDevelop = [reviewPhase, developPhase, votePhase, resultsPhase];

describe('DecisionStateRouter', () => {
  afterEach(cleanup);

  it('sends an admin to the develop admin page while a develop phase awaits selection', () => {
    renderRouter({
      phases: reviewThenDevelop,
      currentStateId: 'develop',
      access: { admin: true },
    });
    expect(screen.getByText('develop admin page')).toBeTruthy();
    expect(screen.queryByText('develop page')).toBeNull();
    expect(screen.queryByText('review selection page')).toBeNull();
  });

  it('sends an admin who also holds develop access to the develop admin page', () => {
    renderRouter({
      phases: reviewThenDevelop,
      currentStateId: 'develop',
      access: { admin: true, developProposals: true },
    });
    expect(screen.getByText('develop admin page')).toBeTruthy();
    expect(screen.queryByText('develop page')).toBeNull();
  });

  it('sends someone with develop access to the develop page', () => {
    renderRouter({
      phases: reviewThenDevelop,
      currentStateId: 'develop',
      access: { developProposals: true },
    });
    expect(screen.getByText('develop page')).toBeTruthy();
    expect(screen.queryByText('develop admin page')).toBeNull();
  });

  it('sends a reviewer without develop access to the develop co-author page', () => {
    renderRouter({
      phases: reviewThenDevelop,
      currentStateId: 'develop',
      access: { review: true },
    });
    expect(screen.getByText('develop co-author page')).toBeTruthy();
    expect(screen.queryByText('develop preparation page')).toBeNull();
    expect(screen.queryByText('standard page')).toBeNull();
    expect(screen.queryByText('develop page')).toBeNull();
    expect(screen.queryByText('develop admin page')).toBeNull();
  });

  it('sends a participant to the develop preparation page', () => {
    renderRouter({
      phases: reviewThenDevelop,
      currentStateId: 'develop',
      access: { submitProposals: true },
    });
    expect(screen.getByText('develop preparation page')).toBeTruthy();
    expect(screen.queryByText('standard page')).toBeNull();
  });

  it('keeps the standard page for a participant once the selection is confirmed', () => {
    renderRouter({
      phases: reviewThenDevelop,
      currentStateId: 'develop',
      access: { submitProposals: true },
      selectionsAreConfirmed: true,
    });
    expect(screen.getByText('standard page')).toBeTruthy();
    expect(screen.queryByText('develop preparation page')).toBeNull();
  });

  it('keeps the review-selection page for an admin when the pending phase is not a develop phase', () => {
    renderRouter({
      phases: [reviewPhase, votePhase, resultsPhase],
      currentStateId: 'vote',
      access: { admin: true, developProposals: true },
    });
    expect(screen.getByText('review selection page')).toBeTruthy();
    expect(screen.queryByText('develop page')).toBeNull();
  });

  it('ignores develop access once the selection is confirmed', () => {
    renderRouter({
      phases: reviewThenDevelop,
      currentStateId: 'develop',
      access: { admin: true, developProposals: true },
      selectionsAreConfirmed: true,
    });
    expect(screen.getByText('standard page')).toBeTruthy();
    expect(screen.queryByText('develop page')).toBeNull();
  });
});
