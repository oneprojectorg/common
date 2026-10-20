// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider, createTranslator } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '../../lib/i18n/dictionaries/en.json';
import {
  PersonalDetailsForm,
  createValidator,
  validator,
} from './PersonalDetailsForm';

const { mutateAsync } = vi.hoisted(() => ({ mutateAsync: vi.fn() }));

vi.mock('@op/api/client', () => {
  const invalidate = () => Promise.resolve();
  return {
    trpc: {
      useUtils: () => ({
        account: {
          getMyAccount: { invalidate },
          getUserProfiles: { invalidate },
        },
        individual: { getTermsByProfile: { invalidate } },
      }),
      account: {
        updateUserProfile: {
          useMutation: () => ({ mutateAsync, isPending: false }),
        },
        getMyAccount: { useQuery: () => ({ data: undefined }) },
      },
    },
  };
});

vi.mock('@/hooks/useProfileImageUpload', () => ({
  useProfileImageUpload: () => ({
    url: undefined,
    upload: vi.fn(),
    isUploading: false,
    uploadError: undefined,
  }),
}));

vi.mock('../Profile/ProfileDetails/FocusAreasField', () => ({
  FocusAreasField: () => null,
}));

const t = createTranslator({ locale: 'en', messages: en });

const details = {
  fullName: 'Ada Lovelace',
  title: '',
  email: 'ada@example.org',
  website: 'https://example.org',
};

describe.concurrent('PersonalDetailsForm validator', () => {
  it('accepts personal details with no headline', () => {
    expect(createValidator(t).safeParse(details)).toMatchObject({
      success: true,
    });
    expect(validator.safeParse(details)).toMatchObject({ success: true });
  });

  it('accepts personal details whose headline is only spaces', () => {
    const result = createValidator(t).safeParse({ ...details, title: '   ' });

    expect(result).toMatchObject({ success: true, data: { title: '' } });
  });

  it('accepts personal details that carry no headline key at all', () => {
    const { title: _title, ...withoutTitle } = details;

    expect(validator.safeParse(withoutTitle)).toMatchObject({ success: true });
  });

  it('refuses personal details with no name', () => {
    const result = createValidator(t).safeParse({ ...details, fullName: '' });

    expect(result).toMatchObject({
      success: false,
      error: { issues: [{ path: ['fullName'] }] },
    });
  });
});

const renderStep = (onNext: (value: unknown) => void = () => {}) =>
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <PersonalDetailsForm
        value={undefined}
        onChange={() => {}}
        onNext={onNext}
        onBack={() => {}}
      />
    </NextIntlClientProvider>,
  );

beforeEach(() => {
  mutateAsync.mockReset();
  mutateAsync.mockResolvedValue(undefined);
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe('PersonalDetailsForm step', () => {
  it('given a new user fills only name and email, when they continue, then the request carries a null headline', async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();
    renderStep(onNext);

    await user.type(
      screen.getByRole('textbox', { name: 'Full name' }),
      'Headline Demo',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Email' }),
      'demo@example.org',
    );
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Headline Demo', bio: null }),
    );
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('refuses to continue when the user clears the name', async () => {
    const user = userEvent.setup();
    renderStep();

    const fullName = screen.getByRole('textbox', { name: 'Full name' });
    await user.type(fullName, 'Headline Demo');
    await user.clear(fullName);
    await user.type(
      screen.getByRole('textbox', { name: 'Email' }),
      'demo@example.org',
    );
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByText('Enter your full name')).toBeTruthy();
    expect(mutateAsync).not.toHaveBeenCalled();
  });
});
