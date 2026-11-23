// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import en from '../../../lib/i18n/dictionaries/en.json';
import { ProcessAdminsDialog } from './ProcessAdminsDialog';

vi.mock('./ProcessAdminsPanel', () => ({
  ProcessAdminsPanel: ({ profileId }: { profileId: string }) => (
    <p>Admins of {profileId}</p>
  ),
}));

afterEach(cleanup);

describe('ProcessAdminsDialog', () => {
  it('opens the admins panel for the process it was given', async () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <ProcessAdminsDialog profileId="profile-9" />
      </NextIntlClientProvider>,
    );
    const user = userEvent.setup();

    expect(screen.queryByText('Admins of profile-9')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Manage admins' }));

    expect(
      await screen.findByRole('dialog', { name: 'Manage admins' }),
    ).toBeTruthy();
    expect(screen.getByText('Admins of profile-9')).toBeTruthy();
  });

  it('closes on Done', async () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <ProcessAdminsDialog profileId="profile-9" />
      </NextIntlClientProvider>,
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Manage admins' }));
    await user.click(await screen.findByRole('button', { name: 'Done' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
