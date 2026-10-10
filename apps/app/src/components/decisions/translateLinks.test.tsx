// @vitest-environment jsdom
import {
  type ProposalReview,
  ProposalReviewState,
  type RubricTemplateSchema,
} from '@op/common/client';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '../../lib/i18n/dictionaries/en.json';
import { DecisionTranslateLink } from './DecisionTranslateLink';
import {
  DecisionTranslationProvider,
  useDecisionTranslation,
} from './DecisionTranslationContext';
import { SubmittedReviewView } from './Review/SubmittedReviewView';
import { RevisionRequestCard } from './RevisionRequestCard';

/** One held-open request per endpoint, settled by the test. */
type Pending = {
  resolve: (data: unknown) => void;
  reject: (error: Error) => void;
};

const { pending, endpoint } = vi.hoisted(() => {
  const pending: Record<string, Pending | undefined> = {};
  const endpoint = (name: string) => ({
    useMutation: () => ({
      mutateAsync: () =>
        new Promise((resolve, reject) => {
          pending[name] = { resolve, reject };
        }),
    }),
  });
  return { pending, endpoint };
});

vi.mock('@op/api/client', () => ({
  trpc: {
    translation: {
      translateDecision: endpoint('translateDecision'),
      translateResources: endpoint('translateResources'),
      translateReview: endpoint('translateReview'),
      translateRevisionRequest: endpoint('translateRevisionRequest'),
    },
  },
}));

const respond = (name: string, data: unknown) =>
  act(async () => pending[name]?.resolve(data));

const ES =
  'Proponemos construir una huerta comunitaria en el parque central del barrio para que las familias tengan alimentos frescos.';
const EN = 'We propose a community garden in the central park.';

const withIntl = (children: ReactNode) => (
  <NextIntlClientProvider locale="en" messages={en}>
    {children}
  </NextIntlClientProvider>
);

const seeTranslation = () =>
  screen.getByRole('button', { name: 'See translation' });

beforeEach(() => {
  for (const key of Object.keys(pending)) {
    pending[key] = undefined;
  }
});

afterEach(() => {
  cleanup();
});

describe('the process link', () => {
  const Headline = () => {
    const translation = useDecisionTranslation();
    return <h1>{translation?.overviewHeadline ?? ES}</h1>;
  };

  const renderProcess = () => {
    render(
      withIntl(
        <DecisionTranslationProvider
          decisionProfileId="decision-1"
          detectionText={ES}
        >
          <DecisionTranslateLink />
          <Headline />
        </DecisionTranslationProvider>,
      ),
    );
    return userEvent.setup();
  };

  it('translates the overview and resources together', async () => {
    const user = renderProcess();

    await user.click(seeTranslation());
    await act(async () => {
      pending.translateDecision?.resolve({
        overviewHeadline: EN,
        phases: [],
        sourceLocale: 'ES',
        targetLocale: 'en',
      });
      pending.translateResources?.resolve({ translations: {} });
    });

    expect(screen.getByRole('heading').textContent).toBe(EN);
    expect(screen.getByText('Translated from Spanish')).toBeTruthy();
  });

  it('treats a response with nothing translated as a failure', async () => {
    const user = renderProcess();

    await user.click(seeTranslation());
    await act(async () => {
      pending.translateDecision?.resolve({
        phases: [],
        sourceLocale: '',
        targetLocale: 'en',
      });
      pending.translateResources?.resolve({ translations: {} });
    });

    expect(screen.getByText('Translation failed.')).toBeTruthy();
    expect(screen.getByRole('heading').textContent).toBe(ES);
  });

  it('offers nothing without a decision', () => {
    render(
      withIntl(
        <DecisionTranslationProvider detectionText={ES}>
          <DecisionTranslateLink />
        </DecisionTranslationProvider>,
      ),
    );

    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('the review link', () => {
  const rubric = {
    type: 'object',
    properties: {
      innovation: {
        type: 'integer',
        title: 'Innovation',
        'x-format': 'dropdown',
        oneOf: [{ const: 1, title: '1' }],
      },
    },
  } as const satisfies RubricTemplateSchema;

  const review: ProposalReview = {
    id: 'review-1',
    assignmentId: 'assignment-1',
    state: ProposalReviewState.SUBMITTED,
    reviewData: { answers: { innovation: 1 }, rationales: { innovation: ES } },
    overallComment: ES,
    submittedAt: null,
    createdAt: null,
    updatedAt: null,
  };

  it('translates the reviewer notes and feedback, not the rubric', async () => {
    const user = userEvent.setup();
    render(
      withIntl(<SubmittedReviewView rubricTemplate={rubric} review={review} />),
    );

    await user.click(seeTranslation());
    await respond('translateReview', {
      rationales: { innovation: EN },
      overallComment: EN,
    });

    expect(screen.getAllByText(EN)).toHaveLength(2);
    expect(screen.queryByText(ES)).toBeNull();
    expect(screen.getByText('Innovation')).toBeTruthy();
  });
});

describe('the revision request link', () => {
  it('translates the request text', async () => {
    const user = userEvent.setup();
    render(
      withIntl(
        <RevisionRequestCard
          request={{ id: 'request-1', requestComment: ES, requestedAt: null }}
        />,
      ),
    );

    await user.click(seeTranslation());
    await respond('translateRevisionRequest', { requestComment: EN });

    expect(screen.getByText(EN)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'View original' })).toBeTruthy();
  });
});
