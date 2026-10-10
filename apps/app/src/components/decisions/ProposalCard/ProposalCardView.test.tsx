// @vitest-environment jsdom
import type { Proposal, ProposalTranslation } from '@op/common/client';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '../../../lib/i18n/dictionaries/en.json';
import fr from '../../../lib/i18n/dictionaries/fr.json';
import { ProposalCardView } from './ProposalCardView';

type TranslateVariables = {
  profileIds: string[];
  targetLocale: string;
};

type TranslateResponse = {
  translations: Record<string, ProposalTranslation>;
};

/** Settles the last translate request, held open until the test says so. */
let pending:
  | {
      resolve: (data: TranslateResponse) => void;
      reject: (error: Error) => void;
    }
  | undefined;

const mutateAsync = vi.fn(
  (_variables: TranslateVariables) =>
    new Promise<TranslateResponse>((resolve, reject) => {
      pending = { resolve, reject };
    }),
);

vi.mock('@op/api/client', () => ({
  trpc: {
    translation: {
      translateProposals: {
        useMutation: () => ({ mutateAsync }),
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
  showTranslateLink?: boolean;
  /** An interactive card root around the link, e.g. the voting toggle. */
  onCardClick?: () => void;
};

const card = ({
  subject = spanish,
  locale = 'en',
  showTranslateLink,
  onCardClick,
}: CardProps): ReactNode => (
  <NextIntlClientProvider locale={locale} messages={locale === 'fr' ? fr : en}>
    <ProposalCardView
      proposal={subject}
      headerBadge={null}
      showTranslateLink={showTranslateLink}
      onClick={onCardClick}
    />
  </NextIntlClientProvider>
);

const renderCard = (props: CardProps = {}) => {
  const { rerender } = render(card(props));
  return {
    user: userEvent.setup(),
    rerender: (next: CardProps) => rerender(card(next)),
  };
};

const lastRequest = () => {
  if (!pending) {
    throw new Error('translateProposals was not called');
  }
  return pending;
};

const succeed = (translations: Record<string, ProposalTranslation>) => {
  const { resolve } = lastRequest();
  return act(async () => resolve({ translations }));
};

const fail = () => {
  const { reject } = lastRequest();
  return act(async () => reject(new Error('translation failed')));
};

const title = () => screen.getByRole('heading').textContent;
const seeTranslation = () =>
  screen.getByRole('button', { name: 'See translation' });

/** Translates the Spanish card into English through the link. */
const translateCard = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(seeTranslation());
  await succeed({ 'profile-1': { title: TITLE_EN } });
};

beforeEach(() => {
  mutateAsync.mockClear();
  pending = undefined;
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

  it('offers nothing on a card that turned the link off', () => {
    renderCard({ showTranslateLink: false });

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('translates only this proposal into the reader locale', async () => {
    const { user } = renderCard();

    await user.click(seeTranslation());

    expect(mutateAsync).toHaveBeenCalledWith({
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
    expect(mutateAsync).toHaveBeenCalledTimes(1);
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

  it('ignores a response that lands after the link was turned off', async () => {
    const { user, rerender } = renderCard();

    await user.click(seeTranslation());
    rerender({ showTranslateLink: false });
    rerender({ showTranslateLink: true });
    await succeed({ 'profile-1': { title: TITLE_EN } });

    expect(title()).toBe(TITLE_ES);
    expect(seeTranslation()).toBeTruthy();
  });

  it('shows an inline failure with a retry when the request fails', async () => {
    const { user } = renderCard();

    await user.click(seeTranslation());
    await fail();

    expect(screen.getByText('Translation failed.')).toBeTruthy();
    expect(title()).toBe(TITLE_ES);

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(mutateAsync).toHaveBeenCalledTimes(2);
  });

  it('treats a response without this proposal as a failure', async () => {
    const { user } = renderCard();

    await user.click(seeTranslation());
    await succeed({});

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
