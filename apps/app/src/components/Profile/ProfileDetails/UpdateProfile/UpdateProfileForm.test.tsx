// @vitest-environment jsdom
import type { Profile } from '@op/api/encoders';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '../../../../lib/i18n/dictionaries/en.json';
import { UpdateProfileForm } from './UpdateProfileForm';

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
        profile: { getBySlug: { invalidate }, list: { invalidate } },
        individual: { getTermsByProfile: { invalidate } },
      }),
      account: {
        updateUserProfile: { useMutation: () => ({ mutateAsync }) },
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

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock('../FocusAreasField', () => ({ FocusAreasField: () => null }));

const profile: Profile = {
  id: '6f1d2c3b-4a5e-4f60-8b7c-9d0e1f2a3b4c',
  type: 'individual',
  slug: 'dev',
  name: 'dev',
  city: null,
  state: null,
  bio: 'Budget delegate facilitator',
  mission: null,
  email: 'dev@example.org',
  website: null,
  headerImage: null,
  avatarImage: null,
  individual: null,
  organization: null,
};

const renderForm = () =>
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <UpdateProfileForm profile={profile} onSuccess={() => {}} />
    </NextIntlClientProvider>,
  );

beforeEach(() => {
  mutateAsync.mockReset();
  mutateAsync.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
});

describe('UpdateProfileForm', () => {
  it('sends null for the headline when the user clears the field and saves', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.clear(screen.getByRole('textbox', { name: 'Headline' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'dev', bio: null }),
    );
  });

  it('sends the trimmed headline when the user types one', async () => {
    const user = userEvent.setup();
    renderForm();

    const headline = screen.getByRole('textbox', { name: 'Headline' });
    await user.clear(headline);
    await user.type(headline, '  Facilitator ');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ bio: 'Facilitator' }),
    );
  });

  it('refuses to save when the user clears the name', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.clear(screen.getByRole('textbox', { name: 'Name' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Enter your full name')).toBeTruthy();
    expect(mutateAsync).not.toHaveBeenCalled();
  });
});
