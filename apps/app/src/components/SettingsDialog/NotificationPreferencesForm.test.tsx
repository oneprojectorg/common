// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import messages from '../../lib/i18n/dictionaries/en.json';
import { NotificationPreferencesForm } from './NotificationPreferencesForm';

const preferences = {
  proposalsAndComments: { email: true, sms: true },
  thingsYouFollow: { email: true, sms: false },
  processUpdates: { email: false, sms: true },
  relationshipRequests: { email: true, sms: true },
};

const renderForm = () => {
  const onChange = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <NotificationPreferencesForm
        preferences={preferences}
        onChange={onChange}
      />
    </NextIntlClientProvider>,
  );
  return { onChange, user: userEvent.setup() };
};

const switchIn = (group: string, channel: string) =>
  within(screen.getByRole('group', { name: group })).getByRole('switch', {
    name: channel,
  });

afterEach(cleanup);

describe('NotificationPreferencesForm', () => {
  it('shows one labelled switch per category and channel, reflecting the stored preference', () => {
    renderForm();

    expect(
      switchIn('Things you follow', 'Email').getAttribute('aria-checked'),
    ).toBe('true');
    expect(
      switchIn('Things you follow', 'SMS').getAttribute('aria-checked'),
    ).toBe('false');
    expect(
      switchIn('Process updates', 'Email').getAttribute('aria-checked'),
    ).toBe('false');
    expect(
      switchIn('Process updates', 'SMS').getAttribute('aria-checked'),
    ).toBe('true');
    expect(screen.getAllByRole('switch')).toHaveLength(8);
  });

  it('given a member turns a channel off, then it reports the category, the channel and the new value', async () => {
    const { onChange, user } = renderForm();

    await user.click(switchIn('Relationship requests', 'SMS'));

    expect(onChange).toHaveBeenCalledWith('relationshipRequests', 'sms', false);
  });

  it('given a member turns a channel on, then it reports the new value as on', async () => {
    const { onChange, user } = renderForm();

    await user.click(switchIn('Process updates', 'Email'));

    expect(onChange).toHaveBeenCalledWith('processUpdates', 'email', true);
  });
});
