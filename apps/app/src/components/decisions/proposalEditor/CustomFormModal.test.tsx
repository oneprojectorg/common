// @vitest-environment jsdom
import type { CustomFormTranslation } from '@op/common/client';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '../../../lib/i18n/dictionaries/en.json';
import { CustomFormModal } from './CustomFormModal';

type TranslateVariables = { customFormId: string; targetLocale: string };
type TranslateResponse = { translated: CustomFormTranslation };

/** Settles the last translate request, held open until the test says so. */
let pending: { resolve: (data: TranslateResponse) => void } | undefined;

const mutateAsync = vi.fn(
  (_variables: TranslateVariables) =>
    new Promise<TranslateResponse>((resolve) => {
      pending = { resolve };
    }),
);

vi.mock('@op/api/client', () => ({
  trpc: {
    translation: {
      translateCustomForm: {
        useMutation: () => ({ mutateAsync }),
      },
    },
  },
}));

vi.mock('@op/hooks', () => ({ useMediaQuery: () => false }));

const schema = {
  type: 'object',
  title: 'Información sobre su organización',
  description:
    'Por favor, responda a las siguientes preguntas sobre su organización y el trabajo que realiza en la comunidad.',
  properties: {
    sector: {
      type: 'string',
      'x-format': 'radio',
      title: '¿En qué sector trabaja su organización?',
      enum: ['Agricultura', 'Educación'],
    },
  },
  required: ['sector'],
};

const translated: CustomFormTranslation = {
  title: 'About your organization',
  description: 'Please answer the following questions.',
  'field_title:sector': 'Which sector does your organization work in?',
  'option:sector:Agricultura': 'Agriculture',
  'option:sector:Educación': 'Education',
};

const onSubmit = vi.fn();

const renderModal = () => {
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <CustomFormModal
        isOpen
        customFormId="form-1"
        schema={schema}
        onSubmit={onSubmit}
        onOpenChange={() => {}}
      />
    </NextIntlClientProvider>,
  );
  return userEvent.setup();
};

beforeEach(() => {
  mutateAsync.mockClear();
  onSubmit.mockClear();
  pending = undefined;
});

afterEach(() => {
  cleanup();
});

describe('CustomFormModal translation', () => {
  it('shows the translated form text and submits the original choice value', async () => {
    const user = renderModal();

    await user.click(screen.getByRole('button', { name: 'See translation' }));
    await act(async () => pending?.resolve({ translated }));

    expect(mutateAsync).toHaveBeenCalledWith({
      customFormId: 'form-1',
      targetLocale: 'en',
    });
    expect(screen.getByText('Translated from Spanish')).toBeTruthy();
    expect(screen.getByText('About your organization')).toBeTruthy();
    expect(
      screen.getByText('Please answer the following questions.'),
    ).toBeTruthy();
    expect(
      screen.getByText('Which sector does your organization work in?'),
    ).toBeTruthy();

    await user.click(screen.getByRole('radio', { name: 'Education' }));
    await user.click(screen.getByRole('button', { name: 'Submit' }));

    expect(onSubmit).toHaveBeenCalledWith({ sector: 'Educación' });
  });

  it('shows the authored text again after "View original"', async () => {
    const user = renderModal();

    await user.click(screen.getByRole('button', { name: 'See translation' }));
    await act(async () => pending?.resolve({ translated }));
    await user.click(screen.getByRole('button', { name: 'View original' }));

    expect(screen.getByText('Información sobre su organización')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Educación' })).toBeTruthy();
  });
});
