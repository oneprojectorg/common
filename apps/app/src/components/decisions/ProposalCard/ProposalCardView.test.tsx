// @vitest-environment jsdom
import type { Proposal, ProposalTranslation } from '@op/common/client';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '../../../lib/i18n/dictionaries/en.json';
import fr from '../../../lib/i18n/dictionaries/fr.json';
import { ProposalTranslationProvider } from '../ProposalTranslationContext';
import { ProposalCardView } from './ProposalCardView';

type TranslateVariables = {
  profileIds: string[];
  targetLocale: string;
};

type MutationOptions = {
  onSuccess: (
    data: { translations: Record<string, ProposalTranslation> },
    variables: TranslateVariables,
  ) => void;
  onError: () => void;
};

const mutate = vi.fn<(variables: TranslateVariables) => void>();
let mutationOptions: MutationOptions | undefined;

vi.mock('@op/api/client', () => ({
  trpc: {
    translation: {
      translateProposals: {
        useMutation: (options: MutationOptions) => {
          mutationOptions = options;
          return { mutate };
        },
      },
    },
  },
}));

// The card's other data hooks query the API; none of them bear on translation.
vi.mock('@/hooks/useCanLinkToProfile', () => ({
  useCanLinkToProfile: () => false,
}));
vi.mock('@/hooks/useProposalEngagement', () => ({
  useProposalEngagement: () => undefined,
}));
vi.mock('../useCommentsAllowed', () => ({
  useCommentsAllowed: () => false,
}));
vi.mock('../proposalReviewDecoration', () => ({
  useProposalReviewDecoration: () => ({}),
}));

const TITLE_ES = 'Huerta comunitaria en el parque central del barrio';
const PREVIEW_ES =
  'Proponemos construir una huerta comunitaria en el parque central del barrio. La huerta ofrecerá alimentos frescos a las familias y será un espacio de encuentro para los vecinos.';
const TITLE_EN = 'Community garden in the central park';
const PREVIEW_EN =
  'We propose building a community garden in the central park. The garden will offer fresh food to families and a meeting place for neighbours.';

// Only the fields the card and language detection read; the full Proposal is
// an API row.
const proposal = ({
  title,
  previewText,
}: {
  title: string;
  previewText: string;
}): Proposal =>
  ({
    id: 'proposal-1',
    profileId: 'profile-1',
    profile: { name: title },
    proposalData: { title },
    previewText,
  }) as unknown as Proposal;

const spanish = proposal({ title: TITLE_ES, previewText: PREVIEW_ES });
const english = proposal({ title: TITLE_EN, previewText: PREVIEW_EN });

type CardProps = {
  subject?: Proposal;
  locale?: 'en' | 'fr';
  bulk?: Record<string, ProposalTranslation>;
  showTranslateLink?: boolean;
  /** An interactive card root around the link, e.g. the voting toggle. */
  onCardClick?: () => void;
};

const card = ({
  subject = spanish,
  locale = 'en',
  bulk = {},
  showTranslateLink,
  onCardClick,
}: CardProps): ReactNode => (
  <NextIntlClientProvider locale={locale} messages={locale === 'fr' ? fr : en}>
    <ProposalTranslationProvider translations={bulk}>
      <ProposalCardView
        proposal={subject}
        headerBadge={null}
        showTranslateLink={showTranslateLink}
        onClick={onCardClick}
      />
    </ProposalTranslationProvider>
  </NextIntlClientProvider>
);

const renderCard = (props: CardProps = {}) => {
  const { rerender } = render(card(props));
  return {
    user: userEvent.setup(),
    rerender: (next: CardProps) => rerender(card(next)),
  };
};

const succeed = (translations: Record<string, ProposalTranslation>) => {
  const variables = mutate.mock.lastCall?.[0];
  if (!mutationOptions || !variables) {
    throw new Error('translateProposals was not called');
  }
  const { onSuccess } = mutationOptions;
  act(() => onSuccess({ translations }, variables));
};

const fail = () => act(() => mutationOptions?.onError());

const title = () => screen.getByRole('heading').textContent;
const seeTranslation = () =>
  screen.getByRole('button', { name: 'See translation' });

/** Translates the Spanish card into English through the link. */
const translateCard = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(seeTranslation());
  succeed({ 'profile-1': { title: TITLE_EN } });
};

beforeEach(() => {
  mutate.mockReset();
  mutationOptions = undefined;
});

afterEach(() => {
  cleanup();
});

describe('ProposalCardView translate link', () => {
  it('offers translation for a proposal in another language', () => {
    renderCard();

    expect(seeTranslation()).toBeTruthy();
  });

  it('offers nothing for a proposal already in the reader language', () => {
    renderCard({ subject: english });

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('offers nothing once the list-level translation covers the card', () => {
    renderCard({ bulk: { 'profile-1': { title: TITLE_EN } } });

    expect(screen.queryByRole('button')).toBeNull();
    expect(title()).toBe(TITLE_EN);
  });

  it('offers nothing on a card that turned the link off', () => {
    renderCard({ showTranslateLink: false });

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('translates only this proposal into the reader locale', async () => {
    const { user } = renderCard();

    await user.click(seeTranslation());

    expect(mutate).toHaveBeenCalledWith({
      profileIds: ['profile-1'],
      targetLocale: 'en',
    });
    const pending = screen.getByRole('button', { name: 'Translating...' });
    expect(pending.getAttribute('aria-disabled')).toBe('true');
    // The original stays on screen until the result lands.
    expect(title()).toBe(TITLE_ES);
  });

  it('swaps in the translation and names the detected source language', async () => {
    const { user } = renderCard();

    await translateCard(user);

    expect(title()).toBe(TITLE_EN);
    expect(screen.getByText('Translated from Spanish')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'View original' })).toBeTruthy();
  });

  it('reverts to the original and reuses the cached translation', async () => {
    const { user } = renderCard();

    await translateCard(user);
    await user.click(screen.getByRole('button', { name: 'View original' }));

    expect(title()).toBe(TITLE_ES);

    await user.click(seeTranslation());

    expect(title()).toBe(TITLE_EN);
    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it('drops a translation made for another locale', async () => {
    const { user, rerender } = renderCard();

    await translateCard(user);
    rerender({ locale: 'fr' });

    expect(title()).toBe(TITLE_ES);
    expect(
      screen.getByRole('button', { name: 'Voir la traduction' }),
    ).toBeTruthy();
  });

  it('stays on the original after the list-level translation is reverted', async () => {
    const { user, rerender } = renderCard();

    await translateCard(user);
    rerender({ bulk: { 'profile-1': { title: TITLE_EN } } });
    // The list's "View original".
    rerender({ bulk: {} });

    expect(title()).toBe(TITLE_ES);
    expect(seeTranslation()).toBeTruthy();
  });

  it('shows an inline failure with a retry when the request fails', async () => {
    const { user } = renderCard();

    await user.click(seeTranslation());
    fail();

    expect(screen.getByText('Translation failed.')).toBeTruthy();
    expect(title()).toBe(TITLE_ES);

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(mutate).toHaveBeenCalledTimes(2);
  });

  it('treats a response without this proposal as a failure', async () => {
    const { user } = renderCard();

    await user.click(seeTranslation());
    succeed({});

    expect(screen.getByText('Translation failed.')).toBeTruthy();
    expect(title()).toBe(TITLE_ES);
  });

  it('does not let the click reach an interactive card root', async () => {
    const onCardClick = vi.fn();
    const { user } = renderCard({ onCardClick });

    await user.click(seeTranslation());

    expect(onCardClick).not.toHaveBeenCalled();
  });
});
