// @vitest-environment jsdom
import type { Proposal, ProposalTranslation } from '@op/common/client';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import messages from '../../../lib/i18n/dictionaries/en.json';
import { ProposalTranslationProvider } from '../ProposalTranslationContext';
import { ProposalTranslateLink } from './ProposalTranslateLink';
import { useProposalCardTranslation } from './useProposalCardTranslation';

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

const TITLE_ES = 'Huerta comunitaria en el parque central del barrio';
const PREVIEW_ES =
  'Proponemos construir una huerta comunitaria en el parque central del barrio. La huerta ofrecerá alimentos frescos a las familias y será un espacio de encuentro para los vecinos.';
const TITLE_EN = 'Community garden in the central park';
const PREVIEW_EN =
  'We propose building a community garden in the central park. The garden will offer fresh food to families and a meeting place for neighbours.';

// Only the fields language detection reads; the full Proposal is an API row.
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

const Harness = ({
  proposal,
  enabled,
}: {
  proposal: Proposal;
  enabled?: boolean;
}) => {
  const translation = useProposalCardTranslation(proposal, { enabled });
  return (
    <>
      <ProposalTranslateLink translation={translation} />
      <p data-testid="title">{translation.translation?.title ?? TITLE_ES}</p>
    </>
  );
};

const renderLink = ({
  subject = spanish,
  bulk = {},
  enabled,
  onCardClick,
}: {
  subject?: Proposal;
  bulk?: Record<string, ProposalTranslation>;
  enabled?: boolean;
  /** An interactive card root around the link, e.g. the voting toggle. */
  onCardClick?: () => void;
} = {}) => {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ProposalTranslationProvider translations={bulk}>
        <div onClick={onCardClick}>
          <Harness proposal={subject} enabled={enabled} />
        </div>
      </ProposalTranslationProvider>
    </NextIntlClientProvider>,
  );
  return userEvent.setup();
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

const seeTranslation = () =>
  screen.getByRole('button', { name: 'See translation' });

beforeEach(() => {
  mutate.mockReset();
  mutationOptions = undefined;
});

afterEach(() => {
  cleanup();
});

describe('ProposalTranslateLink', () => {
  it('offers translation for a proposal in another language', () => {
    renderLink();

    expect(seeTranslation()).toBeTruthy();
  });

  it('offers nothing for a proposal already in the reader language', () => {
    renderLink({ subject: english });

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('offers nothing once the list-level translation covers the card', () => {
    renderLink({ bulk: { 'profile-1': { title: TITLE_EN } } });

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('offers nothing on a card that turned the link off', () => {
    renderLink({ enabled: false });

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('translates only this proposal into the reader locale', async () => {
    const user = renderLink();

    await user.click(seeTranslation());

    expect(mutate).toHaveBeenCalledWith({
      profileIds: ['profile-1'],
      targetLocale: 'en',
    });
    expect(screen.getByText('Translating...')).toBeTruthy();
    // The original stays on screen until the result lands.
    expect(screen.getByTestId('title').textContent).toBe(TITLE_ES);
  });

  it('swaps in the translation and names the detected source language', async () => {
    const user = renderLink();

    await user.click(seeTranslation());
    succeed({ 'profile-1': { title: TITLE_EN } });

    expect(screen.getByTestId('title').textContent).toBe(TITLE_EN);
    expect(screen.getByText('Translated from Spanish')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'View original' })).toBeTruthy();
  });

  it('reverts to the original and reuses the cached translation', async () => {
    const user = renderLink();

    await user.click(seeTranslation());
    succeed({ 'profile-1': { title: TITLE_EN } });
    await user.click(screen.getByRole('button', { name: 'View original' }));

    expect(screen.getByTestId('title').textContent).toBe(TITLE_ES);

    await user.click(seeTranslation());

    expect(screen.getByTestId('title').textContent).toBe(TITLE_EN);
    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it('shows an inline failure with a retry when the request fails', async () => {
    const user = renderLink();

    await user.click(seeTranslation());
    fail();

    expect(screen.getByText('Translation failed.')).toBeTruthy();
    expect(screen.getByTestId('title').textContent).toBe(TITLE_ES);

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(mutate).toHaveBeenCalledTimes(2);
  });

  it('treats a response without this proposal as a failure', async () => {
    const user = renderLink();

    await user.click(seeTranslation());
    succeed({});

    expect(screen.getByText('Translation failed.')).toBeTruthy();
    expect(screen.getByTestId('title').textContent).toBe(TITLE_ES);
  });

  it('does not let the click reach an interactive card behind it', async () => {
    const onCardClick = vi.fn();
    const user = renderLink({ onCardClick });

    await user.click(seeTranslation());

    expect(onCardClick).not.toHaveBeenCalled();
  });
});
