// @vitest-environment jsdom
import type { Proposal, ProposalTranslation } from '@op/common/client';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '../../lib/i18n/dictionaries/en.json';
import { TranslateLink } from './TranslateLink';
import { useTranslateProposal } from './useTranslateProposal';

type TranslateVariables = { profileId: string; targetLocale: string };
type TranslateResponse = { translated: ProposalTranslation };

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
      translateProposal: {
        useMutation: () => ({ mutateAsync }),
      },
    },
  },
}));

const TITLE_ES = 'Huerta comunitaria en el parque central del barrio';
const PREVIEW_ES =
  'Proponemos construir una huerta comunitaria en el parque central del barrio. La huerta ofrecerá alimentos frescos a las familias y será un espacio de encuentro para los vecinos.';
const TITLE_EN = 'Community garden in the central park';

// Only the fields language detection reads; the full Proposal is an API row.
const spanish = {
  id: 'proposal-1',
  profileId: 'profile-1',
  profile: { name: TITLE_ES },
  proposalData: { title: TITLE_ES },
  previewText: PREVIEW_ES,
} as unknown as Proposal;

/** The page's header: the link, then the title it translates. */
const Page = () => {
  const { link, translation } = useTranslateProposal(spanish);
  return (
    <>
      <TranslateLink translation={link} />
      <h1>{translation?.htmlContent.title ?? TITLE_ES}</h1>
    </>
  );
};

const renderPage = () => {
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <Page />
    </NextIntlClientProvider>,
  );
  return userEvent.setup();
};

const respond = (translated: ProposalTranslation) =>
  act(async () => pending?.resolve({ translated }));

const title = () => screen.getByRole('heading').textContent;

beforeEach(() => {
  mutateAsync.mockClear();
  pending = undefined;
});

afterEach(() => {
  cleanup();
});

describe('useTranslateProposal', () => {
  it('translates the whole proposal into the reader locale', async () => {
    const user = renderPage();

    await user.click(screen.getByRole('button', { name: 'See translation' }));
    await respond({ title: TITLE_EN });

    expect(mutateAsync).toHaveBeenCalledWith({
      profileId: 'profile-1',
      targetLocale: 'en',
    });
    expect(title()).toBe(TITLE_EN);
    expect(screen.getByText('Translated from Spanish')).toBeTruthy();
  });

  it('shows the failure inline when the request fails', async () => {
    const user = renderPage();

    await user.click(screen.getByRole('button', { name: 'See translation' }));
    await act(async () => pending?.reject(new Error('translation failed')));

    expect(screen.getByText('Translation failed.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    expect(title()).toBe(TITLE_ES);
  });

  it('treats an empty translation as a failure', async () => {
    const user = renderPage();

    await user.click(screen.getByRole('button', { name: 'See translation' }));
    await respond({});

    expect(screen.getByText('Translation failed.')).toBeTruthy();
    expect(title()).toBe(TITLE_ES);
  });
});
